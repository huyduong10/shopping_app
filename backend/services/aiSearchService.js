const cheerio = require('cheerio');
const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;

const ai = apiKey
  ? new GoogleGenAI({ apiKey })
  : null;

/**
 * Tìm kiếm kết quả thực tế qua DuckDuckGo HTML (100% Free, không cần API Key)
 */
async function searchDuckDuckGo(query) {
  try {
    const res = await fetch(
      'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi,en;q=0.9',
        },
      }
    );

    if (!res.ok) {
      console.warn(`DuckDuckGo trả về mã lỗi: ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    $('.result').each(function () {
      const title = $(this).find('.result__title a').text().trim();
      let rawUrl =
        $(this).find('.result__url').attr('href') ||
        $(this).find('.result__title a').attr('href');
      const snippet = $(this).find('.result__snippet').text().trim();

      if (title && snippet) {
        // Giải mã URL gốc từ redirect của DuckDuckGo (tham số uddg)
        if (rawUrl && rawUrl.includes('uddg=')) {
          const match = rawUrl.match(/uddg=([^&]+)/);
          if (match) {
            rawUrl = decodeURIComponent(match[1]);
          }
        }

        results.push({
          title,
          url: rawUrl,
          snippet,
        });
      }
    });

    return results.slice(0, 6);
  } catch (err) {
    console.error('Lỗi khi tìm kiếm qua DuckDuckGo:', err.message || err);
    return [];
  }
}

/**
 * Lấy nội dung trích xuất nhanh từ các trang web tìm thấy để bổ sung bảng giá (Timeout 3.5s)
 */
async function fetchPageExcerpt(url, maxChars = 1200) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);

    // Loại bỏ các thẻ không chứa nội dung chính
    $('script, style, noscript, nav, footer, header, svg, iframe').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text.substring(0, maxChars);
  } catch {
    return '';
  }
}

/**
 * Gọi Gemini với cơ chế tự động fallback model khi gặp lỗi 503 (quá tải) hoặc 429
 */
async function generateWithFallback(prompt, config = {}) {
  if (!ai) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  // Danh sách các model ưu tiên thử lần lượt (sử dụng model chính thức của Google Gemini API)
  const configuredModel = process.env.GEMINI_MODEL;
  const candidateModels = [
    configuredModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      return response;
    } catch (err) {
      console.warn(`Model ${model} gặp lỗi (${err.status || err.message}), đang thử model kế tiếp...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối đến các model Gemini khả dụng');
}

/**
 * Dịch vụ khảo giá: DuckDuckGo -> Cheerio -> Gemini trích xuất danh sách nhà cung cấp (name, price, url)
 */
async function researchPrice(item) {
  if (!ai) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  // Chuẩn hóa tên trường theo schema đề xuất vật tư (purchaseItemSchema)
  const tenVatTu = (item.tenVatTu || item.name || '').trim();
  const yeuCauKiThuat = (item.yeuCauKiThuat || item.description || '').trim();
  const donGiaDuKien = item.donGiaDuKien;

  // 1. Tạo câu truy vấn tìm kiếm tối ưu
  const searchQuery = `báo giá ${tenVatTu} ${yeuCauKiThuat}`.trim();

  // 2. Tìm kiếm thị trường thực tế bằng DuckDuckGo
  const searchResults = await searchDuckDuckGo(searchQuery);

  // 3. Thu thập thêm nội dung chi tiết từ top 2 trang đầu tiên
  const detailedContext = [];
  for (let i = 0; i < Math.min(searchResults.length, 2); i++) {
    const s = searchResults[i];
    if (s.url && s.url.startsWith('http')) {
      const pageText = await fetchPageExcerpt(s.url);
      if (pageText) {
        detailedContext.push({
          source: s.title,
          url: s.url,
          content: pageText,
        });
      }
    }
  }

  // 4. Prompt yêu cầu Gemini trích xuất chính xác 3 trường: name, price, url
  const prompt = `
Bạn là chuyên gia bóc tách dữ liệu báo giá vật tư và hàng hóa tại Việt Nam.

THÔNG TIN VẬT TƯ:
- Tên vật tư: ${tenVatTu}
- Quy cách / Yêu cầu kỹ thuật: ${yeuCauKiThuat || 'Không có'}
- Đơn giá dự kiến: ${donGiaDuKien ? Number(donGiaDuKien).toLocaleString('vi-VN') + ' VNĐ' : 'Chưa cung cấp'}

DỮ LIỆU TÌM KIẾM TỪ INTERNET:
${JSON.stringify(searchResults, null, 2)}
${detailedContext.length > 0 ? `\nCHI TIẾT NỘI DUNG:\n${JSON.stringify(detailedContext, null, 2)}` : ''}

NHIỆM VỤ:
Trích xuất danh sách các nhà cung cấp / đại lý bán vật tư này thành một JSON Array.
Mỗi phần tử CHỈ gồm đúng 3 trường:
- name: Tên nhà cung cấp / đơn vị phân phối / đại lý (String)
- price: Giá của nhà cung cấp dạng SỐ NGUYÊN (VNĐ). Hãy quy đổi đơn giá về cùng đơn vị tính hoặc mức giá phổ biến trên thị trường (ví dụ nếu đơn giá dự kiến là ~15 triệu thì tính giá theo Tấn ~ 13.700.000 VNĐ, nếu sản phẩm bán theo cái/cuộn thì giữ nguyên giá cái/cuộn).
- url: Đường dẫn link website / bài báo giá của nhà cung cấp đó (String)

YÊU CẦU:
- Chỉ trả về duy nhất mảng JSON thuần túy, không có văn bản giải thích.
Ví dụ định dạng:
[
  {
    "name": "Thép Nhật Long",
    "price": 13700000,
    "url": "https://thepnhatlong.com/gia-thep-cuon-cb240-t"
  }
]
`;

  // 5. Gọi Gemini với responseMimeType: 'application/json'
  const response = await generateWithFallback(prompt, {
    responseMimeType: 'application/json',
  });

  let suppliers = [];
  try {
    const rawText = (response.text || '').trim();
    const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed)) {
      suppliers = parsed.map((s) => ({
        name: String(s.name || s.tenNhaCungCap || 'Nhà cung cấp').trim(),
        price:
          typeof s.price === 'number'
            ? Math.round(s.price)
            : Number(String(s.price || '').replace(/[^\d]/g, '')) || 0,
        url: String(s.url || s.link || '').trim(),
      }));
    }
  } catch (parseErr) {
    console.error('Lỗi parse JSON suppliers:', parseErr);
  }

  // Fallback an toàn nếu Gemini không bóc tách được đủ
  if (suppliers.length === 0 && searchResults.length > 0) {
    suppliers = searchResults.slice(0, 4).map((s) => ({
      name: s.title.split(/[-|–]/)[0].trim() || s.title,
      price: donGiaDuKien || 0,
      url: s.url,
    }));
  }

  return suppliers;
}

module.exports = {
  researchPrice,
};
