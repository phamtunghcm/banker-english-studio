export type ExamId = 'ielts' | 'toefl' | 'toeic';
export type ExamSkill = 'listening' | 'reading' | 'speaking' | 'writing';

export interface ExamMcqQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanationVi: string;
  evidenceQuote?: string;
}

export interface ExamListeningModule {
  title: string;
  subtitle: string;
  audioId: string;
  voiceId: string;
  transcript: string;
  questions: ExamMcqQuestion[];
}

export interface ExamReadingModule {
  title: string;
  subtitle: string;
  passage: string[];
  questions: ExamMcqQuestion[];
}

export interface ExamSpeakingModule {
  title: string;
  subtitle: string;
  prepSeconds: number;
  speakSeconds: number;
  promptBullets: string[];
  modelAudioId: string;
  modelVoiceId: string;
  modelAnswer: string;
  modelAnswerVi: string;
}

export interface ExamWritingModule {
  title: string;
  subtitle: string;
  targetMinWords: number;
  prompt: string;
  topicKeywords: string[];
  sampleAnswer: string;
}

export interface ExamSuite {
  id: ExamId;
  name: string;
  badge: string;
  scaleLabel: string;
  description: string;
  accentClass: string;
  listening: ExamListeningModule;
  reading: ExamReadingModule;
  speaking: ExamSpeakingModule;
  writing: ExamWritingModule;
}

export const EXAM_SUITES: Record<ExamId, ExamSuite> = {
  ielts: {
    id: 'ielts',
    name: 'IELTS Academic (Cambridge)',
    badge: 'Band 0–9.0',
    scaleLabel: 'Thang điểm IELTS 0.0 – 9.0',
    description:
      'Đề mô phỏng chuẩn Cambridge: Listening bẫy distractor, Reading True/False/Not Given có dẫn chứng, Speaking Part 2 Cue Card và Writing Task 2.',
    accentClass: 'indigo',
    listening: {
      title: 'IELTS Listening Section 3 — Seminar on Digital Currencies',
      subtitle: 'Nghe đoạn thảo luận học thuật (giọng Anh - UK) và tránh bẫy đổi ý (distractor).',
      audioId: 'exam-ielts-listen-1',
      voiceId: 'ryan',
      transcript:
        'Good morning, everyone. Today we are reviewing our group case study on central bank digital currencies. Initially, our team planned to focus entirely on retail payments in Southeast Asia, because smartphone adoption there is remarkable. However, after our supervisor pointed out that cross-border wholesale settlements have much richer public data, we shifted our main case study to wholesale banking pilots between Singapore and Hong Kong. One surprising finding was that transaction speed was not the biggest concern for commercial banks; rather, they were most anxious about liquidity outflows during periods of market stress. Please submit your revised literature review by Thursday afternoon, not Friday as originally listed on the syllabus.',
      questions: [
        {
          id: 'ielts-l-q1',
          prompt: 'What is the FINAL main focus of the group case study?',
          options: [
            'Retail smartphone payments in Southeast Asia',
            'Cross-border wholesale banking pilots between Singapore and Hong Kong',
            'Consumer credit card fees in Europe',
          ],
          answerIndex: 1,
          explanationVi:
            'Bẫy distractor: Ban đầu nhóm định làm retail payments ở Đông Nam Á, nhưng "However... we shifted our main case study to wholesale banking pilots between Singapore and Hong Kong".',
        },
        {
          id: 'ielts-l-q2',
          prompt: 'What was commercial banks’ BIGGEST concern in the study?',
          options: [
            'Slow transaction speed',
            'High software licensing costs',
            'Liquidity outflows during periods of market stress',
          ],
          answerIndex: 2,
          explanationVi:
            'Người nói phủ định tốc độ ("not the biggest concern") và nhấn mạnh "most anxious about liquidity outflows during periods of market stress".',
        },
        {
          id: 'ielts-l-q3',
          prompt: 'When is the revised literature review due?',
          options: ['Thursday afternoon', 'Friday afternoon', 'Monday morning'],
          answerIndex: 0,
          explanationVi:
            'Bẫy ngày nộp: "by Thursday afternoon, not Friday as originally listed".',
        },
      ],
    },
    reading: {
      title: 'IELTS Reading — Open Banking & Financial Inclusion',
      subtitle: 'Đọc bài học thuật ngắn & trả lời dạng True / False / Not Given + MCQ (có tô sáng dẫn chứng).',
      passage: [
        'Over the past decade, open banking frameworks have fundamentally altered how retail and corporate financial data are shared. By requiring incumbent banks to expose standardized Application Programming Interfaces (APIs) with customer consent, regulators aimed to foster competition and lower switching costs for borrowers.',
        'Empirical studies across Europe and Asia-Pacific reveal a nuanced picture. Small and medium-sized enterprises (SMEs) with limited physical collateral have benefited significantly, because alternative lenders can now verify real-time cash flows directly from transaction accounts instead of relying solely on audited annual statements.',
        'Nevertheless, consumer adoption has not been uniform across all age groups. While younger professionals readily connect multiple accounts to budgeting apps, surveys indicate that over half of respondents aged fifty-five and above remain hesitant due to perceived cybersecurity risks, even when banks guarantee zero-liability fraud protection.',
      ],
      questions: [
        {
          id: 'ielts-r-q1',
          prompt: 'TRUE, FALSE, or NOT GIVEN: Open banking allows banks to share customer data without asking for customer consent.',
          options: ['TRUE', 'FALSE', 'NOT GIVEN'],
          answerIndex: 1,
          evidenceQuote: 'expose standardized Application Programming Interfaces (APIs) with customer consent',
          explanationVi: 'FALSE — Đoạn 1 ghi rõ "with customer consent" (phải có sự đồng ý của khách hàng).',
        },
        {
          id: 'ielts-r-q2',
          prompt: 'How have SMEs with limited physical collateral benefited from open banking?',
          options: [
            'They receive government tax subsidies automatically.',
            'Lenders can verify their real-time cash flows directly from transaction accounts.',
            'They are exempt from all regulatory compliance checks.',
          ],
          answerIndex: 1,
          evidenceQuote: 'alternative lenders can now verify real-time cash flows directly from transaction accounts',
          explanationVi: 'Đoạn 2 nêu rõ các tổ chức cho vay có thể xác minh dòng tiền thực trực tiếp từ tài khoản giao dịch.',
        },
        {
          id: 'ielts-r-q3',
          prompt: 'TRUE, FALSE, or NOT GIVEN: Most customers aged 55+ still hesitate to adopt open banking despite zero-liability fraud guarantees.',
          options: ['TRUE', 'FALSE', 'NOT GIVEN'],
          answerIndex: 0,
          evidenceQuote: 'over half of respondents aged fifty-five and above remain hesitant due to perceived cybersecurity risks',
          explanationVi: 'TRUE — "over half" = đa số (most), vẫn e ngại rủi ro an ninh mạng dù ngân hàng cam kết bảo vệ.',
        },
      ],
    },
    speaking: {
      title: 'IELTS Speaking Part 2 — Cue Card (Workplace Innovation)',
      subtitle: 'Chuẩn bị 60 giây, nói liên tục trong 2 phút. Có bài mẫu Band 8.0 kèm audio giọng UK.',
      prepSeconds: 60,
      speakSeconds: 120,
      promptBullets: [
        'Describe a new technology or digital tool that improved the way you work.',
        'What the tool is and how you first learned to use it',
        'How it changed your daily workflow or team collaboration',
        'Explain why you would recommend it to other professionals',
      ],
      modelAudioId: 'exam-ielts-speak-1',
      modelVoiceId: 'sonia',
      modelAnswer:
        'I would like to talk about an automated credit-scoring dashboard that our banking team adopted last year. Previously, analysts spent nearly three days manually gathering financial ratios from scattered spreadsheets before every committee meeting. Once we migrated to this digital platform, real-time cash flow indicators and risk alerts were generated in minutes. Consequently, we could dedicate far more energy to strategic client discussions rather than repetitive data entry. I strongly recommend similar automation tools because they significantly reduce human error while elevating overall productivity.',
      modelAnswerVi:
        'Tôi muốn nói về bảng điều khiển chấm điểm tín dụng tự động mà nhóm ngân hàng chúng tôi áp dụng năm ngoái. Trước đây, chuyên viên tốn gần ba ngày gom chỉ số tài chính thủ công từ nhiều file Excel rời rạc trước mỗi cuộc họp hội đồng. Khi chuyển sang nền tảng số này, chỉ số dòng tiền thực và cảnh báo rủi ro được tạo chỉ trong vài phút. Nhờ vậy, chúng tôi dành nhiều thời gian hơn cho trao đổi chiến lược với khách hàng thay vì nhập liệu lặp lại.',
    },
    writing: {
      title: 'IELTS Writing Task 2 — Automation in Financial Services',
      subtitle: 'Viết tối thiểu 120 từ (phiên bản luyện nhanh 15 phút) — AI chấm tức thì cấu trúc, từ nối & Band điểm.',
      targetMinWords: 120,
      prompt:
        'Artificial intelligence is rapidly replacing routine administrative tasks in banks and corporations. Do the advantages of this trend outweigh the disadvantages? Give reasons and relevant examples.',
      topicKeywords: ['automation', 'efficiency', 'productivity', 'risk', 'governance', 'retraining', 'accountability'],
      sampleAnswer:
        'Artificial intelligence is reshaping modern banking by automating repetitive tasks such as document verification and fraud screening. In my view, the advantages of this transformation clearly outweigh the drawbacks, provided that strong governance is maintained. Primarily, automation enhances operational efficiency and reduces human error, allowing staff to focus on complex advisory work. For instance, automated credit memos shorten approval timelines significantly for growing businesses. However, over-reliance on algorithms can introduce compliance risks and displace entry-level roles. Consequently, institutions must invest in continuous staff retraining and transparent human oversight. Overall, when paired with responsible regulation, AI delivers substantial long-term benefits for both employees and customers.',
    },
  },

  toefl: {
    id: 'toefl',
    name: 'TOEFL iBT 2026 (ETS New Format)',
    badge: 'Scale 1.0–6.0',
    scaleLabel: 'Thang điểm TOEFL iBT 2026: 1.0 – 6.0 (quy đổi 0–120)',
    description:
      'Cập nhật đúng chuẩn ETS TOEFL iBT 2026: Academic Listening ngắn gọn, Reading suy luận học thuật, Take an Interview Speaking và Academic Discussion Writing.',
    accentClass: 'teal',
    listening: {
      title: 'TOEFL 2026 Listening — Economics Mini-Lecture on Behavioral Finance',
      subtitle: 'Bài giảng đại học Mỹ ngắn (giọng US) kiểm tra ý chính & ví dụ minh họa.',
      audioId: 'exam-toefl-listen-1',
      voiceId: 'andrew',
      transcript:
        'Welcome back to Behavioral Economics. Classical finance assumes that investors always make purely rational decisions based on all available information. In reality, however, people frequently fall victim to loss aversion—meaning the psychological pain of losing one hundred dollars feels roughly twice as intense as the pleasure of gaining the exact same amount. To illustrate this, consider why many retail investors hold onto declining stocks far too long while selling winning stocks prematurely. They want to avoid locking in a realized loss, even when reallocating that capital into a stronger asset would be far smarter mathematically.',
      questions: [
        {
          id: 'toefl-l-q1',
          prompt: 'What is the main purpose of the professor’s mini-lecture?',
          options: [
            'To prove that classical finance is 100% accurate',
            'To explain how loss aversion causes investors to behave irrationally',
            'To teach students how to calculate stock dividends',
          ],
          answerIndex: 1,
          explanationVi:
            'Giáo sư dùng khái niệm "loss aversion" (ác cảm mất mát) để giải thích vì sao nhà đầu tư hành xử phi lý trí.',
        },
        {
          id: 'toefl-l-q2',
          prompt: 'According to the professor, why do retail investors often hold onto losing stocks too long?',
          options: [
            'They forget their brokerage account passwords.',
            'They want to avoid locking in a realized loss.',
            'Brokerage fees prevent them from selling.',
          ],
          answerIndex: 1,
          explanationVi:
            'Bài giảng nêu rõ: "They want to avoid locking in a realized loss".',
        },
      ],
    },
    reading: {
      title: 'TOEFL 2026 Academic Reading — Sovereign Green Bonds',
      subtitle: 'Đọc đoạn học thuật ngắn chuẩn adaptive TOEFL 2026 & trả lời câu hỏi Suy luận / Từ vựng.',
      passage: [
        'Sovereign green bonds are debt instruments issued by national governments exclusively to finance environmentally beneficial projects, such as renewable power grids or coastal flood defenses. Unlike conventional treasury bonds, issuers must publish annual impact reports demonstrating precisely how proceeds were allocated.',
        'Because global institutional investors face mounting pressure to decarbonize their portfolios, demand for sovereign green bonds often exceeds supply. As a result, governments occasionally achieve a slight pricing advantage known as a "greenium," allowing them to borrow at marginally lower interest rates than standard debt.',
      ],
      questions: [
        {
          id: 'toefl-r-q1',
          prompt: 'How do sovereign green bonds differ from conventional treasury bonds?',
          options: [
            'They are issued only by private startups.',
            'Issuers must report annually on how the funds were allocated to green projects.',
            'They never pay any interest to investors.',
          ],
          answerIndex: 1,
          evidenceQuote: 'issuers must publish annual impact reports demonstrating precisely how proceeds were allocated',
          explanationVi: 'Đoạn 1 chỉ rõ sự khác biệt là báo cáo tác động hàng năm minh bạch việc phân bổ vốn.',
        },
        {
          id: 'toefl-r-q2',
          prompt: 'What does the term "greenium" refer to in paragraph 2?',
          options: [
            'A government fine for polluting factories',
            'A slight borrowing cost advantage enjoyed by green bond issuers',
            'A type of solar panel technology',
          ],
          answerIndex: 1,
          evidenceQuote: 'a slight pricing advantage known as a "greenium," allowing them to borrow at marginally lower interest rates',
          explanationVi: 'Đoạn 2 định nghĩa trực tiếp "greenium" là lợi thế vay vốn với lãi suất thấp hơn đôi chút.',
        },
      ],
    },
    speaking: {
      title: 'TOEFL 2026 Speaking — Take an Interview (45s Response)',
      subtitle: 'Format mới 2026: Trả lời phỏng vấn nhanh trong 45 giây, đi thẳng vào quan điểm + 1 ví dụ cụ thể.',
      prepSeconds: 15,
      speakSeconds: 45,
      promptBullets: [
        'Interviewer: "Should universities require every student, regardless of major, to take a course in financial literacy?"',
        'State your clear position in the first sentence.',
        'Give 1–2 concrete reasons (budgeting, credit scores, avoiding debt traps).',
      ],
      modelAudioId: 'exam-toefl-speak-1',
      modelVoiceId: 'ava',
      modelAnswer:
        'Yes, I strongly believe financial literacy should be a mandatory university course for all majors. Regardless of whether someone studies engineering or literature, every graduate must manage student loans, evaluate credit offers, and plan long-term savings. For example, understanding compound interest early prevents young adults from falling into expensive credit card debt. Therefore, a practical one-semester finance course prepares students for real-world independence far better than optional workshops.',
      modelAnswerVi:
        'Có, tôi tin chắc kiến thức tài chính cá nhân nên là môn bắt buộc cho mọi chuyên ngành đại học. Dù học kỹ thuật hay văn học, sinh viên tốt nghiệp nào cũng phải quản lý khoản vay, đánh giá thẻ tín dụng và tiết kiệm dài hạn. Ví dụ, hiểu lãi kép sớm giúp người trẻ tránh bẫy nợ thẻ tín dụng đắt đỏ.',
    },
    writing: {
      title: 'TOEFL 2026 Writing — Academic Discussion Post',
      subtitle: 'Format chuẩn ETS: Đóng góp ý kiến vào diễn đàn lớp học (tối thiểu 100 từ trong 10 phút).',
      targetMinWords: 100,
      prompt:
        'Professor Clark: "Should cashless payments completely replace physical cash in modern cities, or should businesses still be legally required to accept banknotes?" Write a clear academic discussion post supporting your view.',
      topicKeywords: ['digital', 'inclusion', 'transparency', 'infrastructure', 'risk', 'efficiency', 'elderly'],
      sampleAnswer:
        'While digital payments offer undeniable convenience and greater tax transparency, I believe businesses should still be legally required to accept physical cash. Primarily, a fully cashless society risks excluding vulnerable groups, including elderly citizens and low-income workers who lack reliable smartphones or bank accounts. Furthermore, physical currency serves as a vital backup during power outages or cybersecurity disruptions to payment networks. For instance, when a major banking network experienced an outage last year, cash was the only way commuters could buy essentials. Therefore, cities should promote digital innovation while preserving cash as an inclusive safety net.',
    },
  },

  toeic: {
    id: 'toeic',
    name: 'TOEIC Workplace (ETS)',
    badge: '10–990 điểm',
    scaleLabel: 'Thang điểm TOEIC Listening & Reading (10–990)',
    description:
      'Luyện thực chiến môi trường doanh nghiệp quốc tế: Listening Part 4 Announcement, Reading Part 7 Corporate Email, Speaking & Writing Email phản hồi khách hàng.',
    accentClass: 'blue',
    listening: {
      title: 'TOEIC Listening Part 4 — Office Announcement (System Upgrade)',
      subtitle: 'Nghe thông báo nội bộ công ty (giọng US) và bắt chính xác thời gian, hành động cần làm.',
      audioId: 'exam-toeic-listen-1',
      voiceId: 'andrew',
      transcript:
        'Attention all regional branch staff. This is a reminder that our IT Operations team will perform a mandatory core-banking software upgrade this Saturday from 10:00 PM until 2:00 AM Sunday. During this four-hour window, the internal loan approval portal will be temporarily offline, although customer ATM withdrawals will remain unaffected. Please make sure all pending credit applications are saved and logged out before 9:30 PM on Saturday so no client documents are lost. If you encounter any login issues on Monday morning, submit a ticket through the Helpdesk app rather than calling the main reception desk.',
      questions: [
        {
          id: 'toeic-l-q1',
          prompt: 'Which service will remain AVAILABLE during the Saturday night upgrade?',
          options: [
            'The internal loan approval portal',
            'Customer ATM withdrawals',
            'Live phone support at reception',
          ],
          answerIndex: 1,
          explanationVi:
            'Thông báo nói rõ: "although customer ATM withdrawals will remain unaffected" (rút tiền ATM vẫn hoạt động bình thường).',
        },
        {
          id: 'toeic-l-q2',
          prompt: 'What are staff asked to do before 9:30 PM on Saturday?',
          options: [
            'Call the main reception desk',
            'Save pending credit applications and log out',
            'Restart all office printers',
          ],
          answerIndex: 1,
          explanationVi:
            '"make sure all pending credit applications are saved and logged out before 9:30 PM on Saturday".',
        },
      ],
    },
    reading: {
      title: 'TOEIC Reading Part 7 — Corporate Vendor Memo',
      subtitle: 'Đọc email công sở chuẩn Part 7 & xác định mục đích, hạn chót và yêu cầu cụ thể.',
      passage: [
        'To: All Department Heads | From: Procurement & Finance Committee | Date: October 14 | Subject: Updated Corporate Travel Reimbursement Policy',
        'Starting November 1, all employees traveling for client meetings must book economy flights and partner hotels exclusively through the new TravelSync portal. Bookings made outside the portal will require written pre-approval from a Vice President before expenses can be reimbursed.',
        'In addition, itemized electronic receipts must be uploaded within seven business days after returning from a trip. Meal allowances remain unchanged at sixty dollars per day, and airport taxi receipts no longer require a physical stamp.',
      ],
      questions: [
        {
          id: 'toeic-r-q1',
          prompt: 'What is required if an employee books a hotel OUTSIDE the TravelSync portal after November 1?',
          options: [
            'A physical stamp on the receipt',
            'Written pre-approval from a Vice President',
            'A reduction in their daily meal allowance',
          ],
          answerIndex: 1,
          evidenceQuote: 'Bookings made outside the portal will require written pre-approval from a Vice President',
          explanationVi: 'Đoạn 2 nêu rõ: đặt ngoài hệ thống TravelSync phải có phê duyệt trước bằng văn bản của VP.',
        },
        {
          id: 'toeic-r-q2',
          prompt: 'How soon must employees upload itemized electronic receipts after a business trip?',
          options: ['Within 24 hours', 'Within seven business days', 'By the end of the fiscal year'],
          answerIndex: 1,
          evidenceQuote: 'itemized electronic receipts must be uploaded within seven business days after returning',
          explanationVi: 'Đoạn 3: nộp hóa đơn điện tử chi tiết trong vòng 7 ngày làm việc sau khi về.',
        },
      ],
    },
    speaking: {
      title: 'TOEIC Speaking — Propose a Solution (Client Delay)',
      subtitle: 'Đề xuất giải pháp chuyên nghiệp trong 60 giây khi hồ sơ khách hàng bị chậm tiến độ.',
      prepSeconds: 30,
      speakSeconds: 60,
      promptBullets: [
        'A corporate client left a voicemail complaining that their international wire transfer has been delayed by 24 hours.',
        'Acknowledge the inconvenience politely and professionally.',
        'Explain that compliance verification is nearly complete and offer a concrete follow-up time.',
      ],
      modelAudioId: 'exam-toeic-speak-1',
      modelVoiceId: 'emma',
      modelAnswer:
        'Good afternoon, Mr. Chen. Thank you for calling, and I sincerely apologize for the twenty-four-hour delay on your international wire transfer. I have already checked with our compliance verification team, and the final documentation review is nearly complete. We have prioritized your transaction so that the funds will be released before three o’clock this afternoon. In addition, we will waive the standard wire fee for this transfer, and I will email you the SWIFT confirmation receipt the moment it clears.',
      modelAnswerVi:
        'Chào buổi chiều ông Chen. Cảm ơn ông đã gọi và tôi chân thành xin lỗi vì giao dịch chuyển tiền quốc tế bị chậm 24 giờ. Tôi đã kiểm tra với bộ phận tuân thủ và bước rà soát hồ sơ cuối cùng gần như hoàn tất. Chúng tôi đã ưu tiên giao dịch để tiền được giải ngân trước 3 giờ chiều nay, đồng thời miễn phí chuyển tiền và gửi ngay biên nhận SWIFT khi hoàn tất.',
    },
    writing: {
      title: 'TOEIC Writing — Respond to a Written Request (Email)',
      subtitle: 'Viết email công sở ngắn gọn, lịch sự (tối thiểu 80 từ) xác nhận lịch họp & gửi tài liệu.',
      targetMinWords: 80,
      prompt:
        'A partner from Singapore emailed asking to reschedule tomorrow’s 10:00 AM project review meeting to Thursday afternoon and requested the latest Q3 budget spreadsheet beforehand. Write a professional reply confirming the new time, offering an alternative if needed, and confirming when you will send the budget file.',
      topicKeywords: ['confirm', 'schedule', 'alternative', 'budget', 'deadline', 'proposal', 'clarify'],
      sampleAnswer:
        'Dear Ms. Tan, Thank you for your email regarding tomorrow’s project review. I am pleased to confirm that moving our meeting to Thursday at 2:00 PM works well for our team here in Ho Chi Minh City. However, if Thursday afternoon becomes inconvenient, Friday at 10:00 AM is also available as an alternative. Furthermore, our finance analyst is finalizing the latest Q3 budget spreadsheet, and I will email the updated file to you by 5:00 PM tomorrow so you have ample time to review it beforehand. Please let me know if you need any additional details. Best regards, Linh.',
    },
  },
};
