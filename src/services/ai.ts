// AI Smart Reply Service — uses Gemini if API key is configured; falls back to
// curated Arabic status-aware suggestions otherwise.
//
// NOTE: Integrate a real SMS/FCM gateway here before going to production.

// Local Fallback Matrix based on PRD requirements
const ArabicStatusSuggestions: Record<string, string[]> = {
  'Draft': [
    'يرجى إكمال مواصفات الحالة وإرسالها لبدء المراجعة.',
    'هل تحتاج إلى مساعدة في تعبئة خيارات التصنيع؟',
    'الحالة لا تزال مسودة، يرجى الضغط على إرسال.',
  ],
  'Submitted': [
    'تم استلام الحالة وسيتم مراجعتها.',
    'سيتم إرسال عرض السعر خلال دقائق.',
    'جاري مراجعة الملفات والصور المرفقة.',
  ],
  'Under Review': [
    'جاري مراجعة مواصفات الحالة وملفات الـ STL.',
    'سنقوم بإرسال عرض السعر فور الانتهاء من المراجعة.',
    'الملفات كاملة وسنقوم بالتسعير الآن.',
  ],
  'Quoted': [
    'يرجى مراجعة عرض السعر والموافقة عليه.',
    'تم إرسال عرض السعر، بانتظار موافقتكم لبدء التصنيع.',
    'إذا كان لديكم أي تعديل على التسعير يرجى إعلامنا.',
  ],
  'Approved': [
    'تم استلام الموافقة، وسيتم إدخال الحالة خط الإنتاج فوراً.',
    'شكراً على التأكيد، جاري بدء العمل.',
    'سيتم إبلاغكم فور بدء التصميم الرقمي.',
  ],
  'In Production': [
    'الحالة دخلت مرحلة التصنيع.',
    'جاري العمل على التصميم الرقمي الآن.',
    'الحالة حالياً في مرحلة الخرط والتلبيد بالمعمل.',
  ],
  'Quality Control': [
    'الحالة في مرحلة فحص الجودة الآن.',
    'نقوم بالتأكد من مطابقة اللون والمقاسات للمواصفات.',
    'سيتم الانتهاء من فحص الجودة وتجهيزها للشحن قريباً.',
  ],
  'Ready': [
    'الحالة جاهزة للاستلام.',
    'سيتم تسليم الحالة للمندوب فوراً للتوصيل.',
    'الحالة مطابقة للمواصفات ومغلفة وجاهزة للشحن.',
  ],
  'Delivered': [
    'تم تسليم الحالة للعيادة بنجاح. شكراً لتعاملكم معنا.',
    'نأمل أن تكون النتيجة نالت رضاكم ورضا المريض.',
    'تم تسليم الضمان والعلبة مع الحالة.',
  ],
  'Rework': [
    'تم تسجيل طلب التعديل وجاري العمل عليه فوراً.',
    'نعتذر عن المشكلة وسيتم تعديل الحالة وشحنها غداً.',
    'جاري إعادة التصميم وتلافي الملاحظات المرسلة.',
  ],
  'Cancelled': [
    'تم إلغاء الحالة بناءً على طلبكم.',
    'الحالة ملغاة. يسعدنا خدمتكم في حالات أخرى.',
  ],
};

/**
 * Generate AI-assisted smart replies for a case chat.
 *
 * Returns status-specific Arabic suggestions.
 * When GEMINI_API_KEY is set and valid, integrates Gemini 2.5 Flash.
 * Falls back to the local curated matrix on error or missing key.
 */
export async function generateSmartReplies(
  caseStatus: string,
  lastMessages: string[],
): Promise<string[]> {
  const defaults = ArabicStatusSuggestions[caseStatus] ?? ArabicStatusSuggestions['Submitted'];

  const apiKey = process.env.GEMINI_API_KEY || '';
  const isMockKey = !apiKey || apiKey.startsWith('AIzaSyMock');

  if (isMockKey) {
    return defaults;
  }

  try {
    // Dynamic import — avoids a hard build dependency if the package is absent.
    // To enable Gemini: npm install @google/generative-ai
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const chatHistory = lastMessages.join('\n');
    const prompt = `
You are an AI assistant helping a dental laboratory admin at EDL Dental Lab in Assiut, Egypt.
Based on the current status of the case: "${caseStatus}" and the recent chat history:
${chatHistory || 'No messages yet'}

Suggest 3 short, professional, ready-to-send Arabic replies (under 10 words each).
Output ONLY a valid JSON array: ["الرد الأول", "الرد الثاني", "الرد الثالث"].
`;

    const result = await model.generateContent(prompt);
    const text: string = result.response.text() || '';
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3) as string[];
    }
  } catch (_err) {
    // Fall through to defaults on any error
  }

  return defaults;
}
