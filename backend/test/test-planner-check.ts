/**
 * Runnable Check for Milestone 1: AI Itinerary Planner & Transit Engine
 * Conforms to AGENTS.md rule: Leaves behind ONE runnable check with pure asserts.
 * Run with: npx ts-node -r tsconfig-paths/register test/test-planner-check.ts
 */

import { NestFactory } from '@nestjs/core';
import * as assert from 'assert';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TransitService } from '../src/modules/itineraries/services/transit.service';
import { ItineraryPlannerService } from '../src/modules/itineraries/services/itinerary-planner.service';
import {
  TransitModeEnum,
  IntracityModeEnum,
  BudgetLevelEnum,
  TravelPaceEnum,
} from '../src/modules/itineraries/dto/generate-itinerary.dto';
import {
  checkTransitSafety,
  getDestinationTierMultiplier,
  calculatePlaceEstimatedCost,
} from '../src/config/pricing.config';

async function runCheck() {
  console.log('🚀 [Runnable Check] Initializing NestJS Application Context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const transitService = app.get(TransitService);
    const plannerService = app.get(ItineraryPlannerService);

    console.log('✅ Services resolved successfully.');

    // ── Check 1: Safety Guard Logic ──────────────────────────────────────────
    console.log('\n--- Test 1: Transit Safety Guard ---');
    const safeBike = checkTransitSafety('PERSONAL_MOTORBIKE', 120);
    assert.strictEqual(safeBike, null, 'Motorbike <= 350km should have no warning');

    const dangerousBike = checkTransitSafety('PERSONAL_MOTORBIKE', 500);
    assert.ok(dangerousBike !== null, 'Motorbike > 350km must trigger warning');
    assert.strictEqual(dangerousBike?.level, 'WARNING');
    console.log('Passed: Safety guard flagged 500km motorbike ride:', dangerousBike?.title);

    // ── Check 2: Transit Hub & Flight Deep Link ──────────────────────────────
    console.log('\n--- Test 2: Flight Transit & Deep Links ---');
    const flightTransit = await transitService.calculateIntercityTransit({
      originCity: 'TP. Hồ Chí Minh',
      destCity: 'Đà Nẵng',
      transitMode: TransitModeEnum.FLIGHT,
      departDate: '2026-10-15',
      returnDate: '2026-10-18',
    });

    assert.strictEqual(flightTransit.mode, 'FLIGHT');
    assert.ok(flightTransit.deepLinks.googleFlights?.includes('Flights%20to%20DAD'), 'Flight must use Google Flights');
    assert.ok(flightTransit.estimatedPriceRoundTrip > 0);
    assert.ok(flightTransit.allModesSummary && flightTransit.allModesSummary.length === 4, 'Must provide allModesSummary for 4 vehicles');
    console.log('Passed: Flight Transit SGN -> DAD:');
    console.log(`  Duration: ${flightTransit.durationMinutes} mins`);
    console.log(`  Roundtrip Est: ${flightTransit.estimatedPriceRoundTrip.toLocaleString()} VNĐ`);
    console.log(`  Deep Link: ${flightTransit.deepLinks.googleFlights}`);

    // ── Check 3: Sleeper Bus Transit to Da Lat ───────────────────────────────
    console.log('\n--- Test 3: Sleeper Bus Transit to Da Lat ---');
    const busTransit = await transitService.calculateIntercityTransit({
      originCity: 'TP. Hồ Chí Minh',
      originLat: 10.8231,
      originLng: 106.6297,
      destCity: 'Đà Lạt',
      destLat: 11.9404,
      destLng: 108.4583,
      transitMode: TransitModeEnum.SLEEPER_BUS,
      departDate: '2026-10-20',
    });

    assert.strictEqual(busTransit.mode, 'SLEEPER_BUS');
    assert.ok(busTransit.distanceKm > 200 && busTransit.distanceKm < 450, 'Da Lat road distance ~300km');
    assert.ok(busTransit.estimatedPriceOneWay >= 200_000 && busTransit.estimatedPriceOneWay <= 450_000);
    console.log('busTransit deepLinks:', busTransit.deepLinks);
    assert.ok(busTransit.deepLinks.vexere?.includes('vexere.com'), 'VeXeRe bus link must be present');
    console.log('Passed: Bus Transit HCMC -> Da Lat:');
    console.log(`  Distance: ${busTransit.distanceKm} km`);
    console.log(`  One-way Est: ${busTransit.estimatedPriceOneWay.toLocaleString()} VNĐ`);
    console.log(`  VeXeRe Deep Link: ${busTransit.deepLinks.vexere}`);

    // ── Check 3b: Train Transit from DB ──────────────────────────────────────
    console.log('\n--- Test 3b: Train Transit & Railway Links ---');
    const trainTransit = await transitService.calculateIntercityTransit({
      originCity: 'TP. Hồ Chí Minh',
      destCity: 'Đà Nẵng',
      transitMode: TransitModeEnum.TRAIN,
      departDate: '2026-10-20',
    });
    assert.strictEqual(trainTransit.mode, 'TRAIN');
    assert.ok(trainTransit.deepLinks.dsvn?.includes('dsvn.vn'), 'DSVN official link must be present');
    assert.strictEqual(trainTransit.deepLinks.vexereTrain, 'https://vexere.com/vi-VN/ve-tau-hoa', 'VeXeRe train must point to official ticket search without 404');
    console.log('Passed: Train Transit SGN -> DAD:');
    console.log(`  Duration: ${trainTransit.durationMinutes} mins`);
    console.log(`  VeXeRe Train Link: ${trainTransit.deepLinks.vexereTrain}`);

    // ── Check 3c: Multi-modal Island & Mountain Routing ───────────────────────
    console.log('\n--- Test 3c: Multi-modal Island & Mountain Routing ---');
    // Island Flight (Phú Quốc)
    const phuQuocFlight = await transitService.calculateIntercityTransit({
      originCity: 'TP. Hồ Chí Minh',
      destCity: 'Phú Quốc',
      transitMode: TransitModeEnum.FLIGHT,
      departDate: '2026-10-20',
    });
    assert.strictEqual(phuQuocFlight.destHub?.id, 'PQC', 'Phú Quốc must resolve to PQC airport');
    assert.ok(phuQuocFlight.deepLinks.googleFlights?.includes('PQC'), 'Google flights must target PQC');
    assert.strictEqual(phuQuocFlight.isIsland, true, 'Phú Quốc must be recognized as island');

    // Island Train (Phú Quốc): Must NOT invent "Ga Phú Quốc", must be multi-modal
    const phuQuocTrain = await transitService.calculateIntercityTransit({
      originCity: 'Hà Nội',
      destCity: 'Phú Quốc',
      transitMode: TransitModeEnum.TRAIN,
      departDate: '2026-10-20',
    });
    assert.notStrictEqual(phuQuocTrain.destName, 'Ga Phú Quốc', 'Must NEVER invent fake "Ga Phú Quốc"');
    assert.strictEqual(phuQuocTrain.isMultiModal, true, 'Phú Quốc train must be multi-modal connecting route');
    assert.ok(phuQuocTrain.transferLeg !== undefined, 'Phú Quốc train must have ferry/bus transfer leg');

    // Mainland Mountain (Đà Lạt): Must NOT invent "Ga Đà Lạt", must connect via Ga Tháp Chàm
    const dalatTrain = await transitService.calculateIntercityTransit({
      originCity: 'TP. Hồ Chí Minh',
      destCity: 'Đà Lạt',
      transitMode: TransitModeEnum.TRAIN,
      departDate: '2026-10-20',
    });
    assert.notStrictEqual(dalatTrain.destName, 'Ga Đà Lạt', 'Must NEVER invent fake "Ga Đà Lạt"');
    assert.strictEqual(dalatTrain.isMultiModal, true, 'Đà Lạt train must be multi-modal');
    assert.ok(dalatTrain.destName.includes('Tháp Chàm') || dalatTrain.destName.includes('Nha Trang'), 'Đà Lạt train must connect via Tháp Chàm or Nha Trang');
    console.log('Passed: Multi-modal checks for Phú Quốc (PQC, island) & Đà Lạt (Tháp Chàm transfer leg).');

    const prisma = app.get(PrismaService);
    const owner = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(owner, 'Check needs at least one user row');
    const result = await plannerService.generateItinerary({
      originCity: 'Hồ Chí Minh',
      destinationCity: 'Đà Nẵng',
      destinationLat: 16.0544,
      destinationLng: 108.2022,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      budgetLevel: BudgetLevelEnum.MEDIUM,
      transitMode: TransitModeEnum.SLEEPER_BUS,
      intracityMode: IntracityModeEnum.MOTORBIKE_RENTAL,
      pace: TravelPaceEnum.BALANCED,
      travelStyles: ['CULTURE', 'FOOD', 'RELAX'],
    }, owner.id);

    assert.ok(result.id, 'Itinerary ID must be generated');
    assert.strictEqual(result.totalDays, 3, 'Must have 3 days');
    assert.strictEqual(result.days.length, 3, 'Must return 3 day objects');
    assert.ok(result.budgetBreakdown && result.budgetBreakdown.totalEstimated > 0, 'Total budget must be estimated');
    assert.ok(result.budgetBreakdown && result.budgetBreakdown.accommodation > 0, 'Accommodation budget must be present');
    assert.ok(result.budgetBreakdown && result.budgetBreakdown.food > 0, 'Food budget must be present');
    assert.ok(result.budgetBreakdown && result.budgetBreakdown.localTransit > 0, 'Local transit budget must be present');

    // Integrity: every activity has a valid placeId string; times are "HH:mm" if present
    const TIME_RE = /^\d{2}:\d{2}$/;
    const allActivities = result.days.flatMap((d) => d.activities);
    assert.ok(allActivities.length > 0, 'Persisted destinations expected');
    for (const a of allActivities) {
      assert.ok(typeof a.placeId === 'string', 'placeId must be string');
      if (a.startTime) assert.ok(TIME_RE.test(a.startTime), `bad startTime: ${a.startTime}`);
      if (a.endTime) assert.ok(TIME_RE.test(a.endTime), `bad endTime: ${a.endTime}`);
    }

    // Public read works; non-existent ID throws 404
    const fetched = await plannerService.getById(result.id);
    assert.strictEqual(fetched.id, result.id);
    await assert.rejects(
      () => plannerService.getById('00000000-0000-0000-0000-000000000000'),
      { name: 'NotFoundException' },
    );

    // No leak: area without crawled data must not borrow places from another province
    const noData = await plannerService.generateItinerary({
      originCity: 'Hồ Chí Minh',
      destinationCity: 'Đà Lạt',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
    }, owner.id);
    assert.strictEqual(noData.totalDays, 2);
    // Confirm Da Lat activities do not use Da Nang IDs
    const daNangPlaceIds = new Set(allActivities.map((a) => a.placeId));
    for (const d of noData.days) {
      for (const a of d.activities) {
        assert.ok(!daNangPlaceIds.has(a.placeId), 'Da Lat must not leak Da Nang place IDs');
      }
    }

    console.log('Passed: Generated Itinerary:');
    console.log(`  ID: ${result.id}`);
    console.log(`  Title: ${result.title}`);
    console.log(`  Total Budget: ${result.budgetBreakdown!.totalEstimated.toLocaleString()} VNĐ`);
    console.log(`  Days Count: ${result.days.length}`);
    for (const d of result.days) {
      console.log(`    Day ${d.dayNumber}: ${d.theme} (${d.activities.length} activities)`);
      if (d.activities.length > 0) {
        console.log(`      Sample: ${d.activities[0].startTime} - ${d.activities[0].placeName}`);
      }
    }

    // ── Check 5: time-of-day util round-trip ────────────────────────────────
    console.log('\n--- Test 5: time-of-day util ---');
    const { parseTimeOfDay: p2, formatTimeOfDay: f2 } = await import('../src/common/utils/time-of-day.util');
    assert.strictEqual(f2(p2('08:30')), '08:30');
    assert.strictEqual(f2(p2('9:05')), '09:05');
    assert.strictEqual(p2('invalid'), null);
    assert.strictEqual(p2(null), null);
    console.log('Passed: time-of-day round-trips correctly');

    // ── Check 6: Dynamic Intracity Transit Calculation ──────────────────────
    console.log('\n--- Test 6: Intracity Transit Calculation ---');
    const dayWithMultipleActs = result.days.find((d) => d.activities.length > 1);
    assert.ok(dayWithMultipleActs, 'Expected at least one day with multiple activities');
    const firstAct = dayWithMultipleActs.activities[0];
    assert.ok(typeof firstAct.distanceToNextKm === 'number' && firstAct.distanceToNextKm > 0, 'Distance to next stop must be > 0');
    assert.ok(typeof firstAct.durationToNextMinutes === 'number' && firstAct.durationToNextMinutes > 0, 'Duration to next stop must be calculated and > 0');
    assert.ok(firstAct.travelModeToNext === 'WALK' || firstAct.travelModeToNext === 'BIKE' || firstAct.travelModeToNext === 'CAR');
    console.log(`Passed: Day ${dayWithMultipleActs.dayNumber} Stop 1 -> Stop 2: ${firstAct.distanceToNextKm} km, ~${firstAct.durationToNextMinutes} mins (${firstAct.travelModeToNext})`);

    // ── Check 7: Update Transit Mode (Switch from SLEEPER_BUS to TRAIN) ──────
    console.log('\n--- Test 7: Update Transit Mode ---');
    const updatedItin = await plannerService.updateTransitMode(result.id, TransitModeEnum.TRAIN, owner.id);
    assert.strictEqual(updatedItin.intercityTransit?.mode, 'TRAIN', 'Transit mode must be updated to TRAIN');
    assert.ok(updatedItin.intercityTransit?.deepLinks.dsvn, 'Train booking link must be present');
    assert.strictEqual(
      updatedItin.budgetBreakdown?.transitRoundTrip,
      updatedItin.intercityTransit?.estimatedPriceRoundTrip,
      'Budget breakdown transit cost must match new mode',
    );
    assert.ok(updatedItin.budgetBreakdown?.totalEstimated! > 0);
    console.log('Passed: Updated transit mode to TRAIN:');
    console.log(`  New Mode: ${updatedItin.intercityTransit.mode}`);
    console.log(`  New Transit Cost: ${updatedItin.budgetBreakdown!.transitRoundTrip.toLocaleString()} VNĐ`);
    console.log(`  New Total Budget: ${updatedItin.budgetBreakdown!.totalEstimated.toLocaleString()} VNĐ`);

    // ── Check 8: Bottom-Up Pricing & Destination Tiers ─────────────────────
    console.log('\n--- Test 8: Bottom-Up Pricing & Destination Tiers ---');
    // Tier multipliers
    const hcmTier = getDestinationTierMultiplier('Thành phố Hồ Chí Minh');
    assert.strictEqual(hcmTier, 1.25, 'HCM should be Tier 1 (1.25x)');
    const canThoTier = getDestinationTierMultiplier('Cần Thơ');
    assert.strictEqual(canThoTier, 0.8, 'Can Tho should be Tier 3 (0.8x)');
    const daNangTier = getDestinationTierMultiplier('Đà Nẵng');
    assert.strictEqual(daNangTier, 1.0, 'Da Nang should be Tier 2 (1.0x)');

    // Place Cost Estimation: Free attraction
    const freePlace = calculatePlaceEstimatedCost({
      category: { slug: 'thien-nhien', nameVi: 'Thiên nhiên & Biển' },
      priceRange: { min: 0, max: 0 },
      placeName: 'Bãi biển Mỹ Khê',
    });
    assert.strictEqual(freePlace.cost, 0);
    assert.strictEqual(freePlace.isFree, true);
    assert.strictEqual(freePlace.isDining, false);

    // Place Cost Estimation: Ticketed Attraction
    const ticketPlace = calculatePlaceEstimatedCost({
      category: { slug: 'di-tich-lich-su', nameVi: 'Di tích lịch sử' },
      priceRange: { min: 40000, max: 40000 },
      placeName: 'Dinh Độc Lập',
    });
    assert.strictEqual(ticketPlace.cost, 40000);
    assert.strictEqual(ticketPlace.isFree, false);
    assert.strictEqual(ticketPlace.isDining, false);

    // Place Cost Estimation: Dining median
    const diningPlace = calculatePlaceEstimatedCost({
      category: { slug: 'nha-hang', nameVi: 'Nhà hàng ẩm thực' },
      priceRange: { min: 35000, max: 65000 },
      placeName: 'Bún bò Huế Bà Tuyết',
    });
    assert.strictEqual(diningPlace.cost, 50000); // (35000 + 65000) / 2 = 50000
    assert.strictEqual(diningPlace.isDining, true);

    // Check activity estimatedCost field on generated itinerary
    const checkedActivities = result.days.flatMap((d) => d.activities);
    assert.ok(checkedActivities.length > 0);
    assert.ok(checkedActivities.some((a) => a.estimatedCost != null), 'Expected at least some activities with estimatedCost');
    console.log(`Passed: Bottom-up pricing verified with ${checkedActivities.length} activities.`);
    console.log(`  Tickets in Breakdown: ${result.budgetBreakdown?.tickets.toLocaleString()} VNĐ`);
    console.log(`  Food in Breakdown: ${result.budgetBreakdown?.food.toLocaleString()} VNĐ`);

    // ── Check 9: Spatial Bounding Box Isolation (Phu Quoc Itinerary) ───────
    console.log('\n--- Test 9: Spatial Bounding Box Isolation (Phú Quốc) ---');
    const pqResult = await plannerService.generateItinerary({
      originCity: 'TP. Hồ Chí Minh',
      destinationCity: 'Phú Quốc',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      budgetLevel: BudgetLevelEnum.MEDIUM,
      transitMode: TransitModeEnum.FLIGHT,
      intracityMode: IntracityModeEnum.MOTORBIKE_RENTAL,
      travelStyles: ['BEACH', 'FOOD'],
    });

    assert.ok(pqResult.id, 'Phu Quoc itinerary must be generated');
    assert.notStrictEqual(pqResult.intercityTransit, null);
    const pqActivities = pqResult.days.flatMap((d) => d.activities);
    assert.ok(pqActivities.length >= 4, 'Must have at least 4 activities for 2 days');

    for (const act of pqActivities) {
      // Must be within Phu Quoc latitude range [9.8, 10.6] and longitude range [103.5, 104.5]
      assert.ok(
        act.latitude >= 9.8 && act.latitude <= 10.6,
        `Activity "${act.placeName}" latitude ${act.latitude} must be in Phu Quoc range [9.8, 10.6], never Da Nang (16.0)`
      );
      assert.ok(
        act.longitude >= 103.5 && act.longitude <= 104.5,
        `Activity "${act.placeName}" longitude ${act.longitude} must be in Phu Quoc range [103.5, 104.5], never Da Nang (108.2)`
      );
      // Address must never mention Da Nang or Hoi An
      if (act.address) {
        assert.ok(!act.address.includes('Đà Nẵng'), `Activity address "${act.address}" must not mention Đà Nẵng`);
        assert.ok(!act.address.includes('Hội An'), `Activity address "${act.address}" must not mention Hội An`);
      }
    }
    console.log(`Passed: Verified ${pqActivities.length} activities in Phú Quốc are 100% geographically isolated.`);
    for (const act of pqActivities) {
      console.log(`  - [Day ?] ${act.placeName} (${act.latitude}, ${act.longitude}) | ${act.address}`);
    }

    console.log('\n🎉 ALL RUNNABLE CHECKS PASSED SUCCESSFULLY!');
    await app.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ Check Failed:', err);
    await app.close();
    process.exit(1);
  }
}

runCheck();
