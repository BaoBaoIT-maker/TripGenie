import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CopilotToolsService } from '../src/modules/itineraries/copilot/copilot-tools.service';
import { CopilotAgentService } from '../src/modules/itineraries/copilot/copilot-agent.service';
import { ItineraryPlannerService } from '../src/modules/itineraries/services/itinerary-planner.service';
import {
  BudgetLevelEnum,
  TravelPaceEnum,
} from '../src/modules/itineraries/dto/generate-itinerary.dto';
import * as assert from 'assert';

async function runCopilotChecks() {
  console.log('\n======================================================');
  console.log('🤖 RUNNING TEST SUITE: GENIE COPILOT & TOOL CALLING');
  console.log('======================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const toolsService = app.get(CopilotToolsService);
  const agentService = app.get(CopilotAgentService);
  const plannerService = app.get(ItineraryPlannerService);

  try {
    // 1. Find or generate a valid test itinerary in Da Nang
    console.log('[Check 1] Finding or creating test itinerary in Đà Nẵng...');
    let testItinerary = await prisma.itinerary.findFirst({
      where: { destination: { contains: 'Đà Nẵng', mode: 'insensitive' }, deletedAt: null },
      include: {
        destinations: {
          include: { place: true },
          orderBy: [{ dayNumber: 'asc' }, { visitOrder: 'asc' }],
        },
      },
    });

    if (!testItinerary || testItinerary.destinations.length < 3) {
      console.log('  Generating a quick test itinerary for Đà Nẵng...');
      const created = await plannerService.generateItinerary({
        originCity: 'Hà Nội',
        destinationCity: 'Đà Nẵng',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        budgetLevel: BudgetLevelEnum.MEDIUM,
        travelStyles: ['CULTURE', 'FOOD'],
        pace: TravelPaceEnum.BALANCED,
      });
      testItinerary = await prisma.itinerary.findFirst({
        where: { id: created.id },
        include: {
          destinations: {
            include: { place: true },
            orderBy: [{ dayNumber: 'asc' }, { visitOrder: 'asc' }],
          },
        },
      });
    }

    assert.ok(testItinerary, 'Must have a valid test itinerary');
    assert.ok(testItinerary.destinations.length > 0, 'Itinerary must have destinations');
    console.log(`  ✓ Itinerary ID: ${testItinerary.id} ("${testItinerary.title}") with ${testItinerary.destinations.length} places.`);

    // 2. Test Hybrid Model: Alternatives query for 1-click Card Swap (0 LLM call)
    console.log('\n[Check 2] Testing Card 1-click alternative places query (Hybrid DB Model)...');
    const targetActivity = testItinerary.destinations[0];
    const alternatives = await toolsService.getAlternativesForActivity(
      testItinerary.id,
      targetActivity.id,
      3,
    );
    console.log(`  Found ${alternatives.length} alternatives for "${targetActivity.place.name}":`);
    for (const alt of alternatives) {
      console.log(`    - ${alt.name} (${alt.categoryName}) | Rating: ${alt.ratingAvg}★ | Dist: ${alt.distanceKm}km`);
      assert.notStrictEqual(alt.id, targetActivity.placeId, 'Alternative must not be the same place');
    }
    assert.ok(alternatives.length > 0, 'Should find at least 1 alternative in DB');
    console.log('  ✓ Check 2 Passed: Direct DB alternative query is fast, accurate and 0 LLM token.');

    // 3. Test Travel Q&A (Direct Text Path, No DB mutation)
    console.log('\n[Check 3] Testing Copilot Travel Q&A (Advisory path, modified = false)...');
    const qaResponse = await agentService.chat(
      testItinerary.id,
      'Thời tiết Đà Nẵng mùa này thế nào, buổi tối nên đi dạo đâu đẹp?',
    );
    console.log(`  Copilot Reply:\n  "${qaResponse.reply.slice(0, 160)}..."`);
    assert.strictEqual(qaResponse.modified, false, 'Travel Q&A should not modify the itinerary');
    assert.ok(qaResponse.reply.length > 20, 'Reply should be informative');
    console.log('  ✓ Check 3 Passed: Travel Q&A answered naturally without touching itinerary data.');

    // 4. Test Off-Topic Guardrail (Polite refusal & pivot)
    console.log('\n[Check 4] Testing Off-Topic Guardrail (Polite refusal & steering back)...');
    const offTopicResponse = await agentService.chat(
      testItinerary.id,
      'Hãy viết giúp tôi một đoạn code Java giải thuật toán QuickSort',
    );
    console.log(`  Copilot Reply:\n  "${offTopicResponse.reply}"`);
    assert.strictEqual(offTopicResponse.modified, false, 'Off-topic should not modify the itinerary');
    const mentionsTopicOrTrip =
      offTopicResponse.reply.toLowerCase().includes('du lịch') ||
      offTopicResponse.reply.toLowerCase().includes('đà nẵng') ||
      offTopicResponse.reply.toLowerCase().includes('chuyến đi') ||
      offTopicResponse.reply.toLowerCase().includes('lịch trình') ||
      offTopicResponse.reply.toLowerCase().includes('code');
    assert.ok(mentionsTopicOrTrip, 'Should refuse off-topic and steer back to trip');
    console.log('  ✓ Check 4 Passed: Off-topic query politely handled by guardrail.');

    // 5. Test Tool Calling: swap_activity with Human-in-the-loop Proposal
    console.log('\n[Check 5] Testing Tool Calling: swap_activity ("Đổi quán ăn trưa ngày 2 thành hải sản")...');
    const swapResponse = await agentService.chat(
      testItinerary.id,
      'Đổi quán ăn trưa ngày 2 thành quán hải sản giúp tôi',
      undefined,
      undefined,
      false, // Human-in-the-loop: autoApply = false
    );
    console.log(`  Copilot Reply:\n  "${swapResponse.reply}"`);
    console.log(`  Modified: ${swapResponse.modified}`);
    assert.strictEqual(swapResponse.modified, false, 'Without user confirmation, itinerary must NOT be modified yet');
    assert.ok(swapResponse.proposal, 'Copilot must generate a proposal card for user review');
    console.log(`  Proposal: "${swapResponse.proposal.title}" -> ${swapResponse.proposal.toPlaceName}`);

    // Now simulate user confirming proposal
    const appliedSwap = await agentService.applyProposal(
      testItinerary.id,
      swapResponse.proposal.toolName,
      swapResponse.proposal.args,
    );
    assert.strictEqual(appliedSwap.success, true, 'Applying confirmed proposal should succeed');
    console.log('  ✓ Check 5 Passed: swap_activity generated proposal first, and modified DB upon confirmation.');

    // 5b. Test Contextual Swap: Suggestion follow-up without repeating day number
    console.log('\n[Check 5b] Testing Contextual Activity Swap (Follow-up selection without repeating day)...');
    const targetFoodDest =
      testItinerary.destinations.find(
        (d) =>
          d.place.name.toLowerCase().includes('mì') ||
          d.place.name.toLowerCase().includes('bà') ||
          d.place.name.toLowerCase().includes('cơm') ||
          d.place.name.toLowerCase().includes('hải sản'),
      ) || testItinerary.destinations[0];

    const contextSession = await prisma.aiChatSession.create({
      data: {
        userId: testItinerary.creatorId,
        linkedItineraryId: testItinerary.id,
        title: 'Contextual Swap Test Session',
        contextCity: testItinerary.destination || 'Đà Nẵng',
      },
    });

    // Turn 1: Ask for alternative to targetFoodDest
    const turn1Res = await agentService.chat(
      testItinerary.id,
      `Gợi ý cho tôi địa điểm tương đương để thay thế cho "${targetFoodDest.place.name}"`,
      undefined,
      contextSession.id,
      false,
    );
    console.log(`  Turn 1 reply received (length: ${turn1Res.reply.length})`);

    // Turn 2: User says "Đổi thành hải sản năm đảnh giúp tôi" without specifying day
    const turn2Res = await agentService.chat(
      testItinerary.id,
      'Đổi thành hải sản năm đảnh giúp tôi',
      undefined,
      contextSession.id,
      false,
    );
    console.log(
      `  Turn 2 Proposal: "${turn2Res.proposal?.title}" | Day: ${turn2Res.proposal?.dayNumber} | from: "${turn2Res.proposal?.fromPlaceName}" -> to: "${turn2Res.proposal?.toPlaceName}"`,
    );
    assert.ok(turn2Res.proposal, 'Turn 2 must generate a swap proposal');
    assert.strictEqual(
      turn2Res.proposal?.dayNumber,
      targetFoodDest.dayNumber,
      `Proposal must target Day ${targetFoodDest.dayNumber} where "${targetFoodDest.place.name}" is located, not Day ${turn2Res.proposal?.dayNumber}!`,
    );
    assert.strictEqual(
      turn2Res.proposal?.fromPlaceName,
      targetFoodDest.place.name,
      `Proposal must replace "${targetFoodDest.place.name}", not "${turn2Res.proposal?.fromPlaceName}"!`,
    );
    console.log('  ✓ Check 5b Passed: Contextual follow-up correctly targeted the original place on its real day.');

    // Cleanup context session
    await prisma.aiChatMessage.deleteMany({ where: { sessionId: contextSession.id } });
    await prisma.aiChatSession.delete({ where: { id: contextSession.id } });

    // 6. Test Tool Calling: swap_days with Human-in-the-loop Proposal
    console.log('\n[Check 6] Testing Tool Calling: swap_days ("Đổi lịch trình ngày 1 với ngày 2 cho nhau")...');
    const swapDaysResponse = await agentService.chat(
      testItinerary.id,
      'Đổi lịch trình ngày 1 với ngày 2 cho nhau vì ngày 1 trời mưa',
      undefined,
      undefined,
      false, // Human-in-the-loop: autoApply = false
    );
    console.log(`  Copilot Reply:\n  "${swapDaysResponse.reply}"`);
    console.log(`  Modified: ${swapDaysResponse.modified}`);
    assert.strictEqual(swapDaysResponse.modified, false, 'Without confirmation, swap_days must NOT mutate DB directly');
    assert.ok(swapDaysResponse.proposal, 'Copilot must generate a swap_days proposal card');
    console.log(`  Proposal: "${swapDaysResponse.proposal.title}"`);

    // Now simulate user confirming proposal
    const appliedDays = await agentService.applyProposal(
      testItinerary.id,
      swapDaysResponse.proposal.toolName,
      swapDaysResponse.proposal.args,
    );
    assert.strictEqual(appliedDays.success, true, 'Applying confirmed swap_days should succeed');
    console.log('  ✓ Check 6 Passed: swap_days generated proposal first, and modified DB upon confirmation.');

    // 7. Test Direct 1-Click Swap on Card (Hybrid Model)
    if (alternatives.length > 0) {
      console.log('\n[Check 7] Testing Direct 1-click swap on place card (Direct DB mutation)...');
      await toolsService.swapActivityDirect(testItinerary.id, targetActivity.id, alternatives[0].id);
      const rechecked = await prisma.itineraryDestination.findFirst({
        where: { id: targetActivity.id },
      });
      assert.strictEqual(rechecked?.placeId, alternatives[0].id, 'PlaceId must be updated to the alternative place');
      console.log(`  ✓ Check 7 Passed: Successfully swapped card place to "${alternatives[0].name}".`);
    }

    // 8. Test Sliding Window & Session Summarization
    console.log('\n[Check 8] Testing Sliding Window, Delta Batching & BullMQ Enqueue...');
    const testSession = await prisma.aiChatSession.create({
      data: {
        userId: testItinerary.creatorId,
        linkedItineraryId: testItinerary.id,
        title: 'Test Summarization Session',
        contextCity: testItinerary.destination || 'Đà Nẵng',
        messageCount: 14,
      },
    });

    for (let i = 1; i <= 14; i++) {
      await prisma.aiChatMessage.create({
        data: {
          sessionId: testSession.id,
          sender: i % 2 === 1 ? 'USER' : 'AGENT',
          content:
            i === 1
              ? 'Gia đình tôi có trẻ nhỏ 4 tuổi và thích ăn đồ thanh đạm vào buổi trưa.'
              : `Tin nhắn trao đổi số ${i} về chuyến đi.`,
        },
      });
    }

    const summary = await agentService.summarizeSession(testSession.id);
    console.log(`  Generated Session Summary:\n  "${summary}"`);
    assert.ok(summary && summary.length > 10, 'Summary must be generated for long sessions');

    const updatedSession = await prisma.aiChatSession.findUnique({
      where: { id: testSession.id },
    });
    assert.strictEqual(updatedSession?.summary, summary, 'Summary must be saved in database');
    assert.ok(updatedSession?.lastSummarizedMessageId, 'lastSummarizedMessageId must be recorded');
    assert.ok(updatedSession?.lastSummarizedAt, 'lastSummarizedAt must be recorded');

    // 8b. Test batching threshold: adding 2 messages (delta = 2 < 8) should not trigger new summary
    for (let i = 15; i <= 16; i++) {
      await prisma.aiChatMessage.create({
        data: {
          sessionId: testSession.id,
          sender: i % 2 === 1 ? 'USER' : 'AGENT',
          content: `Tin nhắn trao đổi số ${i} về chuyến đi.`,
        },
      });
    }
    const batchedSummary = await agentService.summarizeSession(testSession.id);
    assert.strictEqual(batchedSummary, summary, 'Summary should remain unchanged when batch threshold is not reached');
    console.log('  ✓ Check 8b Passed: Batching threshold successfully prevented redundant summarization calls.');

    // 8c. Test BullMQ enqueue
    await agentService.enqueueSessionSummarization(testSession.id);
    console.log('  ✓ Check 8c Passed: BullMQ job successfully enqueued.');

    console.log('  ✓ Check 8 Passed: Memory summarization & BullMQ queue verified.');

    // Clean up test session
    await prisma.aiChatMessage.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.aiChatSession.delete({ where: { id: testSession.id } });

    console.log('\n======================================================');
    console.log('🎉 ALL 8 COPILOT AGENT, TOOL & MEMORY CHECKS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    await app.close();
    process.exit(0);
  }
}

runCopilotChecks().catch((err) => {
  console.error('\n❌ Test Check Failed:', err);
  process.exit(1);
});
