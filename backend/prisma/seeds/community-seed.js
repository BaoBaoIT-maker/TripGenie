const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedCommunity() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding travel creators, community groups, and destination community posts...');

    // 0. Ensure community_groups & moderation schema migration is applied
    const migrationPath = path.resolve(
      __dirname,
      '../migrations/20261108152000_community_groups_moderation_and_verified_creator/migration.sql'
    );
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(migrationSql);
    }

    // 1. Update creators profile (avatar & username)
    await client.query(`
      UPDATE users SET
        username = 'thutrang.travel',
        avatar_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
      WHERE email = 'thutrang.travel@gmail.com'
    `);

    await client.query(`
      UPDATE users SET
        username = 'hoanglong.danang',
        avatar_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
      WHERE email = 'hoanglong.danang@gmail.com'
    `);

    await client.query(`
      UPDATE users SET
        username = 'minhtuan.wander',
        avatar_url = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
      WHERE email = 'minhtuan.wander@gmail.com'
    `);

    await client.query(`
      UPDATE users SET
        username = 'quynhanh.foodie',
        avatar_url = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80'
      WHERE email = 'quynhanh.foodie@gmail.com'
    `);

    // Get user IDs
    const usersRes = await client.query(`
      SELECT id, email FROM users
      WHERE email IN (
        'thutrang.travel@gmail.com',
        'hoanglong.danang@gmail.com',
        'minhtuan.wander@gmail.com',
        'quynhanh.foodie@gmail.com'
      )
    `);
    const usersMap = {};
    usersRes.rows.forEach(u => { usersMap[u.email] = u.id; });

    // Mark Admin & Top Travel Creators as verified creators (Tích xanh Thổ địa)
    await client.query(`
      UPDATE users
      SET is_verified_creator = true
      WHERE role = 'ADMIN'
         OR email IN (
           'thutrang.travel@gmail.com',
           'hoanglong.danang@gmail.com',
           'quynhanh.foodie@gmail.com',
           'minhtuan.wander@gmail.com'
         );
    `);

    const adminRes = await client.query(`
      SELECT id FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL LIMIT 1;
    `);
    const adminId = adminRes.rows[0]?.id ?? null;

    // 2. Assign and publicize itineraries to respective creators
    const itinTrang = '07193fbd-62c2-42f3-9a48-cf932ffd3b0a';
    const itinLong = 'ae5cf5a6-5685-4e3f-a6c0-198d4f31be15';
    const itinTuan = '691037cb-2a56-40a3-9c64-e58ca9140969';
    const itinQuynh = '831372b9-9325-482f-b00c-f8cd8f399a20';

    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['thutrang.travel@gmail.com'], itinTrang]);
    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['hoanglong.danang@gmail.com'], itinLong]);
    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['minhtuan.wander@gmail.com'], itinTuan]);
    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['quynhanh.foodie@gmail.com'], itinQuynh]);

    // 3. Seed Default General Group & Admin-curated Community Topic Groups
    const groupsData = [
      {
        name: 'Cộng đồng chung TripGenie',
        slug: 'cong-dong-chung',
        subtitle: 'Sảnh chung • Mọi hành trình & chia sẻ',
        description:
          'Không gian chung dành cho tất cả thành viên TripGenie chia sẻ kinh nghiệm, lịch trình và hỏi đáp du lịch.',
        iconUrl:
          'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=160&auto=format&fit=crop&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80',
        isDefault: true,
        sortOrder: 0,
      },
      {
        name: 'Săn Mây & Núi Rừng',
        slug: 'san-may-nui-rung',
        subtitle: 'Đà Lạt, Sa Pa, Tà Xùa, Hà Giang',
        description:
          'Hội đam mê săn mây đón bình minh, chinh phục đèo cao và ngắm cảnh sắc thiên nhiên đại ngàn.',
        iconUrl:
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=160&auto=format&fit=crop&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
        isDefault: false,
        sortOrder: 1,
      },
      {
        name: 'Food Tour Địa Phương',
        slug: 'food-tour-dia-phuong',
        subtitle: 'Hải Phòng, Huế, Hội An, Sài Gòn',
        description:
          'Review quán ngon bản địa, đặc sản ngõ ngách và bản đồ ẩm thực chuẩn vị thổ địa.',
        iconUrl:
          'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=160&auto=format&fit=crop&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
        isDefault: false,
        sortOrder: 2,
      },
      {
        name: 'Biển Đảo & Resort',
        slug: 'bien-dao-resort',
        subtitle: 'Phú Quốc, Nha Trang, Đà Nẵng, Quy Nhơn',
        description:
          'Chia sẻ kinh nghiệm nghỉ dưỡng resort, lặn ngắm san hô và khám phá các hòn đảo đẹp nhất Việt Nam.',
        iconUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=160&auto=format&fit=crop&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
        isDefault: false,
        sortOrder: 3,
      },
      {
        name: 'Cắm Trại & Chữa Lành',
        slug: 'cam-trai-chua-lanh',
        subtitle: 'Hồ Trị An, Măng Đen, Bảo Lộc',
        description:
          'Cộng đồng yêu thích glamping, cắm trại ven hồ, trekking nhẹ nhàng và du lịch chữa lành cuối tuần.',
        iconUrl:
          'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=160&auto=format&fit=crop&q=80',
        coverUrl:
          'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&auto=format&fit=crop&q=80',
        isDefault: false,
        sortOrder: 4,
      },
    ];

    const groupMap = {};
    for (const g of groupsData) {
      const res = await client.query(
        `
        INSERT INTO community_groups (
          name, slug, subtitle, description, icon_url, cover_url, is_default, is_active, sort_order, created_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          subtitle = EXCLUDED.subtitle,
          description = EXCLUDED.description,
          icon_url = EXCLUDED.icon_url,
          cover_url = EXCLUDED.cover_url,
          is_default = EXCLUDED.is_default,
          sort_order = EXCLUDED.sort_order,
          updated_at = NOW()
        RETURNING id, slug;
        `,
        [
          g.name,
          g.slug,
          g.subtitle,
          g.description,
          g.iconUrl,
          g.coverUrl,
          g.isDefault,
          g.sortOrder,
          adminId,
        ]
      );
      groupMap[res.rows[0].slug] = res.rows[0].id;
    }

    // 4. Clean up previous seed posts from these 4 test creators to ensure fresh destination content & images
    const creatorIds = Object.values(usersMap).filter(Boolean);
    if (creatorIds.length > 0) {
      console.log('Cleaning up previous seed posts from test creators...');
      await client.query(`
        DELETE FROM community_posts
        WHERE user_id = ANY($1::uuid[]);
      `, [creatorIds]);
    }

    // 5. Insert High-quality Destination-Focused Community Posts (100% scenic landmark photography)
    const postsData = [
      {
        userId: usersMap['thutrang.travel@gmail.com'],
        itineraryId: null, // Không cần lộ trình
        groupId: groupMap['san-may-nui-rung'],
        title: 'Chinh phục biển mây Tà Xùa & Sống lưng Khủng Long: Cẩm nang đón bình minh chạm tay vào mây ngàn',
        caption: 'Vừa trở về sau chuyến săn mây Tà Xùa 2N1Đ đẹp ngoài sức tưởng tượng! Biển mây bồng bềnh cuồn cuộn dưới thung lũng từ 5h30 sáng, trời trong vắt không một gợn gió. Đứng trên Đỉnh Gió ngắm nhìn dãy Hoàng Liên Sơn hùng vĩ mà cảm giác như lạc vào cõi tiên. Mọi người nên chọn đi vào những ngày sau mưa phùn, độ ẩm cao thì tỷ lệ gặp biển mây đặc gần như 100% nha!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1609412058473-c199497c3c5d?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#taxua', '#sanmay', '#hoanglienson', '#travelvietnam'],
        likeCount: 58,
        commentCount: 2,
        cloneCount: 0,
        comments: [
          { email: 'hoanglong.danang@gmail.com', content: 'Biển mây Tà Xùa đỉnh thật sự chị ơi! Tầm tháng mấy trong năm là dễ gặp mây nhất vậy ạ?' },
          { email: 'thutrang.travel@gmail.com', content: 'Từ tháng 10 đến tháng 4 năm sau là mùa mây đẹp nhất em nha, canh hôm nào gió nhẹ là mây đứng yên cực ảo!' }
        ]
      },
      {
        userId: usersMap['minhtuan.wander@gmail.com'],
        itineraryId: null, // Không cần lộ trình
        groupId: groupMap['bien-dao-resort'],
        title: 'Thiên đường biển đảo Phú Quốc: 4 bãi tắm nước xanh ngọc bích & góc ngắm hoàng hôn đẹp nhất Nam Đảo',
        caption: 'Phú Quốc mùa này biển êm như gương, làn nước xanh ngọc bích nhìn thấu tận đáy. Trải nghiệm cano 4 đảo Hòn Mây Rút, Hòn Gầm Ghì lặn ngắm san hô tự nhiên siêu đỉnh. Chiều về ghé Sunset Sanato hoặc Bãi Sao đón hoàng hôn đỏ rực cả chân trời. Không khí biển trong lành chữa lành mọi căng thẳng!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#phuquoc', '#biendao', '#namdao', '#sunset'],
        likeCount: 45,
        commentCount: 2,
        cloneCount: 0,
        comments: [
          { email: 'thutrang.travel@gmail.com', content: 'Hoàng hôn Phú Quốc chụp ngược sáng góc biển thì mê ly, nhìn ảnh thèm đi biển quá Tuấn ơi!' },
          { email: 'minhtuan.wander@gmail.com', content: 'Nước mùa này trong vắt luôn Trang ơi, đi đợt này vừa vắng vừa chill nữa!' }
        ]
      },
      {
        userId: usersMap['hoanglong.danang@gmail.com'],
        itineraryId: itinLong, // Đính kèm lộ trình Đà Nẵng - Hội An để nhân bản
        groupId: groupMap['food-tour-dia-phuong'],
        title: 'Cẩm nang du lịch Đà Nẵng - Hội An: Thả đèn hoa đăng sông Hoài & check-in Cầu Vàng Bà Nà',
        caption: 'Chia sẻ cùng cả nhà bộ ảnh và lịch trình 3N2Đ kết hợp Đà Nẵng và Phố cổ Hội An. Tối thả đèn hoa đăng lung linh dọc bờ sông Hoài, ban ngày lên Bà Nà Hills dạo bước trên Cầu Vàng bồng bềnh giữa mây trời và ngắm Cầu Rồng phun lửa lúc 21h cuối tuần. Đã đính kèm lịch trình chi tiết mọi người có thể nhân bản về tài khoản để đi ngay nhé!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#danang', '#hoian', '#cauvang', '#di-san'],
        likeCount: 96,
        commentCount: 2,
        cloneCount: 24,
        comments: [
          { email: 'minhtuan.wander@gmail.com', content: 'Đúng lịch trình mình đang cần cho chuyến du lịch cùng gia đình, đã bấm nhân bản về rồi cảm ơn bạn!' },
          { email: 'quynhanh.foodie@gmail.com', content: 'Ai ghé Hội An nhớ thử cao lầu bà Bé với bánh mì Phượng nữa là trọn vẹn chuyến đi nha!' }
        ]
      },
      {
        userId: usersMap['quynhanh.foodie@gmail.com'],
        itineraryId: itinTrang, // Đính kèm lộ trình Đà Lạt
        groupId: groupMap['san-may-nui-rung'],
        title: 'Đà Lạt những ngày chớm đông: Đồi chè Cầu Đất xanh mướt, sương mây Hồ Tuyền Lâm & hoa dã quỳ',
        caption: 'Đà Lạt mùa này đẹp dịu dàng và bình yên lắm mọi người ơi. Sáng sớm chạy xe qua rừng thông mù sương xuống bờ Hồ Tuyền Lâm ngắm mặt nước phẳng lặng như gương, trưa lên đồi chè Cầu Đất ngút ngàn đón gió trong lành. Tối se se lạnh ngồi bên nồi lẩu gà lá é bốc khói nghi ngút. Cảm giác bao muộn phiền tan biến hết!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1546548970-71785318a17b?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#dalat', '#caudat', '#hotuyenlam', '#thiennhien'],
        likeCount: 78,
        commentCount: 2,
        cloneCount: 18,
        comments: [
          { email: 'hoanglong.danang@gmail.com', content: 'Góc chụp rừng thông mù sương nghệ quá Quỳnh Anh ơi, đường đi đồi chè Cầu Đất mùa này có xấu không bạn?' },
          { email: 'quynhanh.foodie@gmail.com', content: 'Đường nhựa trải thẳng tắp đi xe máy hay ô tô đều êm ru bạn nha!' }
        ]
      },
      {
        userId: usersMap['minhtuan.wander@gmail.com'],
        itineraryId: null, // Không cần lộ trình
        groupId: groupMap['cam-trai-chua-lanh'],
        title: 'Rời phố về rừng: Cuối tuần cắm trại ven hồ Trị An, đốt lửa trại và ngắm bầu trời sao',
        caption: 'Tạm gác lại deadline và tiếng còi xe, nhóm mình vừa có 2 ngày cắm trại cực chill bên bờ hồ Trị An. Buổi chiều dựng lều đón gió mát lộng, chiều tà ngắm hoàng hôn buông nhuộm tím mặt hồ, đêm đến quây quần bên đống lửa nướng khoai và ngắm bầu trời sao lấp lánh. Một chuyến đi ngắn ngày nhưng nạp lại trọn vẹn năng lượng!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#camping', '#chualanh', '#camtrai', '#hotrian'],
        likeCount: 42,
        commentCount: 2,
        cloneCount: 0,
        comments: [
          { email: 'thutrang.travel@gmail.com', content: 'Hồ Trị An cắm trại qua đêm có an toàn và có chỗ thuê lều trại sẵn không Tuấn?' },
          { email: 'minhtuan.wander@gmail.com', content: 'Có nhiều bãi glamping dịch vụ trọn gói lều nệm sạch sẽ, an ninh tốt lắm chị Trang ơi!' }
        ]
      },
      {
        userId: usersMap['thutrang.travel@gmail.com'],
        itineraryId: null, // Không cần lộ trình
        groupId: groupMap['cong-dong-chung'],
        title: 'Ninh Bình non nước kỳ vĩ: Xuôi dòng Tràng An xuyên hang động & thu trọn Tam Cốc từ đỉnh Hang Múa',
        caption: 'Nếu hỏi nơi nào ở miền Bắc non nước hữu tình nhất, mình xin bầu một phiếu cho Ninh Bình! Thuyền nhẹ trôi trên dòng sông ngô đồng xanh biếc, hai bên là vách núi đá vôi sừng sững nghìn năm. Leo gần 500 bậc thang đá lên đỉnh Hang Múa đón hoàng hôn buông xuống thung lũng Tam Cốc đẹp đến nghẹt thở. Nhất định phải ghé một lần trong đời!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#ninhbinh', '#trangan', '#hangmua', '#vietnamtravel'],
        likeCount: 67,
        commentCount: 2,
        cloneCount: 0,
        comments: [
          { email: 'hoanglong.danang@gmail.com', content: 'Tràng An đi tuyến thuyền số 2 hay số 3 thì cảnh đẹp hơn vậy Trang?' },
          { email: 'thutrang.travel@gmail.com', content: 'Tuyến số 3 xuyên hang dài nhất và có bối cảnh phim Kong chụp ảnh siêu đẹp nha Long!' }
        ]
      },
      {
        userId: usersMap['hoanglong.danang@gmail.com'],
        itineraryId: null, // Không cần lộ trình
        groupId: groupMap['san-may-nui-rung'],
        title: 'Hành trình Đông Bắc: Đi thuyền hẻm vực Tu Sản sông Nho Quế & vượt Đệ nhất hùng quan Mã Pí Lèng',
        caption: 'Cảm giác đứng giữa đèo Mã Pí Lèng nhìn xuống dòng sông Nho Quế xanh như ngọc bích chảy qua hẻm vực Tu Sản thực sự choáng ngợp. Cung đường đèo uốn lượn lưng chừng mây, những nếp nhà của đồng bào bình yên giữa đá núi tai mèo. Tuổi trẻ nhất định phải một lần đặt chân đến địa đầu Tổ quốc Hà Giang!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?w=1200&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1509023464722-18d996393ca8?w=1200&auto=format&fit=crop&q=80'
        ],
        tags: ['#hagiang', '#songnhoque', '#mapileng', '#phuot'],
        likeCount: 84,
        commentCount: 2,
        cloneCount: 0,
        comments: [
          { email: 'quynhanh.foodie@gmail.com', content: 'Sông Nho Quế nước xanh màu ngọc bích quanh năm luôn hả anh Long ơi?' },
          { email: 'hoanglong.danang@gmail.com', content: 'Đúng rồi Quỳnh Anh, đi thuyền kayak xuôi hẻm Tu Sản mát rượi và hùng vĩ lắm nè!' }
        ]
      }
    ];

    for (const post of postsData) {
      const ins = await client.query(`
        INSERT INTO community_posts (
          user_id, itinerary_id, group_id, title, caption, media_urls, tags,
          like_count, comment_count, clone_count, moderation_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'APPROVED', NOW(), NOW())
        RETURNING id;
      `, [
        post.userId,
        post.itineraryId,
        post.groupId,
        post.title,
        post.caption,
        post.mediaUrls,
        post.tags,
        post.likeCount,
        post.commentCount,
        post.cloneCount
      ]);
      const postId = ins.rows[0].id;
      console.log(`Inserted post "${post.title.slice(0, 35)}..." (id: ${postId})`);

      for (const comment of post.comments) {
        const commenterId = usersMap[comment.email];
        if (commenterId) {
          await client.query(`
            INSERT INTO post_comments (post_id, user_id, content, created_at)
            VALUES ($1, $2, $3, NOW());
          `, [postId, commenterId, comment.content]);
        }
      }
    }

    // 6. Synchronize post_count for all community_groups
    await client.query(`
      UPDATE community_groups cg
      SET post_count = CASE
        WHEN cg.is_default = true THEN (
          SELECT COUNT(*)::int FROM community_posts cp
          WHERE cp.deleted_at IS NULL AND cp.moderation_status = 'APPROVED'
        )
        ELSE (
          SELECT COUNT(*)::int FROM community_posts cp
          WHERE cp.group_id = cg.id AND cp.deleted_at IS NULL AND cp.moderation_status = 'APPROVED'
        )
      END;
    `);

    await client.query('COMMIT');
    console.log('Seeding completed successfully with fresh destination posts and images!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCommunity();
