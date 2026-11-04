require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedCommunity() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding travel creators and community posts...');

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

    // 2. Assign and publicize itineraries to respective creators
    const itinTrang = '07193fbd-62c2-42f3-9a48-cf932ffd3b0a';
    const itinLong = 'ae5cf5a6-5685-4e3f-a6c0-198d4f31be15';
    const itinTuan = '691037cb-2a56-40a3-9c64-e58ca9140969';
    const itinQuynh = '831372b9-9325-482f-b00c-f8cd8f399a20';

    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['thutrang.travel@gmail.com'], itinTrang]);
    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['hoanglong.danang@gmail.com'], itinLong]);
    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['minhtuan.wander@gmail.com'], itinTuan]);
    await client.query('UPDATE itineraries SET creator_id = $1, is_public = true WHERE id = $2', [usersMap['quynhanh.foodie@gmail.com'], itinQuynh]);

    // 3. Insert Posts (avoiding duplicates by title)
    const postsData = [
      {
        userId: usersMap['thutrang.travel@gmail.com'],
        itineraryId: itinTrang,
        title: 'Review chi tiết Đà Lạt 3N2Đ: Săn mây đồi chè Cầu Đất, cafe thung lũng & lẩu gà lá é',
        caption: 'Vừa hoàn thành chuyến đi Đà Lạt cùng hội bạn thân! Không khí se lạnh mùa này siêu thích, sáng sớm săn mây ở Cầu Đất đón bình minh tuyệt đẹp. Buổi tối ghé lẩu gà lá é Tao Ngộ làm ấm bụng rồi dạo chợ đêm. Mọi người có thể nhân bản lịch trình này về tài khoản để đi nhé!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&auto=format&fit=crop&q=80'
        ],
        tags: ['#dalat', '#review', '#chill', '#amthuc'],
        likeCount: 48,
        commentCount: 2,
        cloneCount: 9,
        comments: [
          { email: 'hoanglong.danang@gmail.com', content: 'Lịch trình hay quá chị ơi! Cho em hỏi sáng săn mây mấy giờ xuất phát từ trung tâm thì kịp ạ?' },
          { email: 'thutrang.travel@gmail.com', content: 'Tầm 4h30 sáng chạy xe máy lên là vừa đẹp em nha, đường vắng đi tầm 45 phút!' }
        ]
      },
      {
        userId: usersMap['hoanglong.danang@gmail.com'],
        itineraryId: itinLong,
        title: 'Cẩm nang du lịch Đà Nẵng - Hội An cho gia đình & cặp đôi: Ăn gì, chơi đâu tiết kiệm nhất?',
        caption: 'Chia sẻ với cả nhà lộ trình 3N2Đ kết hợp Đà Nẵng và Phố cổ Hội An. Tối ngắm cầu Rồng phun lửa, ban ngày tắm biển Mỹ Khê và chiều vào phố cổ thả đèn hoa đăng. Chi phí siêu hợp lý chỉ khoảng 2.5 triệu/người bao gồm vé tham quan và ăn uống no nê!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1528127269322-539801943592?w=1000&auto=format&fit=crop&q=80'
        ],
        tags: ['#danang', '#hoian', '#travel', '#kinhnghiem'],
        likeCount: 92,
        commentCount: 2,
        cloneCount: 23,
        comments: [
          { email: 'minhtuan.wander@gmail.com', content: 'Đúng lịch trình mình đang cần luôn, đã nhân bản về tài khoản rồi cảm ơn bạn!' },
          { email: 'quynhanh.foodie@gmail.com', content: 'Thêm quán mì Quảng Ếch Bếp Trang vào ngày 2 nữa là chuẩn bài luôn đó Long ơi.' }
        ]
      },
      {
        userId: usersMap['minhtuan.wander@gmail.com'],
        itineraryId: itinTuan,
        title: 'Trải nghiệm Phú Quốc 3N2Đ: Ngắm hoàng hôn Sunset Sanato & lặn ngắm san hô Hòn Thơm',
        caption: 'Phú Quốc mùa này biển êm như gương, nước xanh ngọc bích. Hành trình 3 ngày trải nghiệm cáp treo vượt biển, cano 4 đảo và thưởng thức hải sản tươi rói tại làng chài Hàm Ninh. Đừng quên lưu lại lịch trình nhé!',
        mediaUrls: [
          'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80'
        ],
        tags: ['#phuquoc', '#biendao', '#sunset', '#travel'],
        likeCount: 37,
        commentCount: 2,
        cloneCount: 7,
        comments: [
          { email: 'thutrang.travel@gmail.com', content: 'Sunset Sanato chụp ảnh hoàng hôn ngược sáng siêu nghệ luôn!' },
          { email: 'minhtuan.wander@gmail.com', content: 'Chuẩn luôn Trang ơi, nhớ đến từ 16h30 để chọn góc chụp đẹp nhất nha.' }
        ]
      },
      {
        userId: usersMap['quynhanh.foodie@gmail.com'],
        itineraryId: itinQuynh,
        title: 'Lộ trình Cà phê Chill & Ẩm thực ngõ ngách Đà Lạt cho tâm hồn mộng mơ',
        caption: 'Nếu bạn không thích chen chúc đông đúc, hãy thử theo lịch trình này của Quỳnh Anh: toàn những quán cafe ẩn mình trong rừng thông, đường hoa cẩm tú cầu và quán nướng ngói cực kỳ ấm cúng. Điểm dừng chân nào cũng được AI gợi ý thời gian phù hợp.',
        mediaUrls: [
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80'
        ],
        tags: ['#dalat', '#cafechill', '#foodie', '#checkin'],
        likeCount: 76,
        commentCount: 2,
        cloneCount: 16,
        comments: [
          { email: 'hoanglong.danang@gmail.com', content: 'Quán cafe trong rừng thông tên gì vậy bạn, đường đi có dốc lắm không?' },
          { email: 'quynhanh.foodie@gmail.com', content: 'Quán Túi Mơ To bạn nhé, đường bê tông dễ đi xe ga lên thoải mái nè!' }
        ]
      }
    ];

    for (const post of postsData) {
      const existing = await client.query('SELECT id FROM community_posts WHERE title = $1', [post.title]);
      let postId;
      if (existing.rows.length > 0) {
        postId = existing.rows[0].id;
        console.log(`Post "${post.title.slice(0, 30)}..." already exists (id: ${postId})`);
      } else {
        const ins = await client.query(`
          INSERT INTO community_posts (user_id, itinerary_id, title, caption, media_urls, tags, like_count, comment_count, clone_count, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING id;
        `, [
          post.userId,
          post.itineraryId,
          post.title,
          post.caption,
          post.mediaUrls,
          post.tags,
          post.likeCount,
          post.commentCount,
          post.cloneCount
        ]);
        postId = ins.rows[0].id;
        console.log(`Inserted post "${post.title.slice(0, 30)}..." (id: ${postId})`);
      }

      for (const comment of post.comments) {
        const commenterId = usersMap[comment.email];
        const commentExist = await client.query(
          'SELECT id FROM post_comments WHERE post_id = $1 AND user_id = $2 AND content = $3',
          [postId, commenterId, comment.content]
        );
        if (commentExist.rows.length === 0) {
          await client.query(`
            INSERT INTO post_comments (post_id, user_id, content, created_at)
            VALUES ($1, $2, $3, NOW());
          `, [postId, commenterId, comment.content]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');
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
