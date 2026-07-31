import React, { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle,
  AlertTriangle,
  Send,
  Lock,
  MessageSquare,
  Upload,
  ArrowRight,
  Shield,
  Bot,
  RefreshCw,
  X,
} from 'lucide-react';

interface FeedbackUserFlowViewProps {
  campaignId: string;
  botUsername: string;
}

export const FeedbackUserFlowView: React.FC<FeedbackUserFlowViewProps> = ({
  campaignId,
  botUsername,
}) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // User details after OTP verification
  const [verifiedUser, setVerifiedUser] = useState<any>(null);

  // Input states
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorText, setErrorText] = useState('');

  // Feedback fields
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState<'wallet' | 'referral' | 'withdraw' | 'ui' | 'speed' | 'support'>('wallet');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Fetch campaign information on load
  useEffect(() => {
    const fetchCampaignInfo = async () => {
      if (!campaignId) {
        setCampaignError('No Campaign ID specified in URL.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/feedback/campaign-info?campaignId=${campaignId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setCampaign(data.campaign);
          if (!data.campaign.active) {
            if (data.campaign.isExpired) {
              setCampaignError('This feedback campaign has expired.');
            } else if (data.campaign.isNotStarted) {
              setCampaignError('This feedback campaign has not started yet.');
            } else {
              setCampaignError('This feedback campaign is currently disabled.');
            }
          }
        } else {
          setCampaignError(data.error || 'This feedback campaign could not be found.');
        }
      } catch (err: any) {
        setCampaignError('Unable to load feedback campaign. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignInfo();
  }, [campaignId]);

  // Request OTP via bot
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!cleanMobile) {
      setErrorText('Please enter a valid registered mobile number.');
      return;
    }

    setIsSendingOtp(true);
    setErrorText('');
    try {
      const response = await fetch('/api/feedback/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanMobile,
          campaignId: campaignId,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setOtpSentMessage(data.message || 'OTP sent successfully.');
        setStep(3); // Advance to Step 3 (Telegram bot instructions)
      } else {
        setErrorText(data.error || 'Failed to send OTP. Please check your number.');
      }
    } catch (err: any) {
      setErrorText('Network error sending OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!cleanMobile || !otp.trim()) {
      setErrorText('Please enter both mobile and OTP code.');
      return;
    }

    setIsVerifyingOtp(true);
    setErrorText('');
    try {
      const response = await fetch('/api/feedback/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanMobile,
          otp: otp.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setVerifiedUser(data.user);
        setStep(5); // Advance to Feedback Form
      } else {
        setErrorText(data.error || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setErrorText('Network error verifying OTP. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle Drag & Drop Screenshot upload
  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Only image uploads are accepted.');
      return;
    }
    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Image exceeds the 5MB size limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotBase64(reader.result as string);
      setScreenshotName(file.name);
    };
    reader.onerror = () => {
      alert('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
    setScreenshotBase64(null);
    setScreenshotName(null);
  };

  // Submit final feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a feedback title.');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaignId,
          uid: verifiedUser.uid,
          name: verifiedUser.name,
          mobile: verifiedUser.mobile,
          telegramId: verifiedUser.telegramId,
          telegramUsername: verifiedUser.telegramUsername,
          rating,
          category,
          title: title.trim(),
          message: message.trim(),
          screenshotUrl: screenshotBase64,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setStep(6); // Advance to Success Screen
      } else {
        alert(data.error || 'Failed to submit feedback.');
      }
    } catch (err: any) {
      alert('Network error submitting feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Loading campaign surveys...</p>
      </div>
    );
  }

  // Error Screen
  if (campaignError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Campaign Unavailable</h2>
            <p className="text-xs sm:text-sm text-slate-400">{campaignError}</p>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-4">
            If you believe this is an error, please contact Roy Share Wallet Support.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl animate-scaleIn">
        {/* Stepper Progress bar */}
        {step < 6 && (
          <div className="h-1.5 w-full bg-slate-950 flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-full transition-all duration-300 ${
                  s <= step ? 'bg-gradient-to-r from-sky-500 to-blue-500' : 'bg-transparent'
                }`}
              />
            ))}
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* STEP 1: WELCOME SCREEN */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 mx-auto animate-pulse">
                <MessageSquare className="w-8 h-8 text-sky-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  {campaign?.name || 'Roy Share Survey'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Thank you for helping Roy Share Wallet. Your honest thoughts help us craft the best wallet and sharing engine.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Reward Bonus</span>
                  <p className="text-lg font-extrabold text-emerald-400 font-mono">₹{campaign?.bonusAmount}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Requirements</span>
                  <p className="text-xs font-semibold text-slate-300">Registered Wallet Owner</p>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-sky-500/15 hover:shadow-sky-500/25 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: REGISTERED MOBILE */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-white">Enter Mobile Number</h3>
                <p className="text-xs text-slate-450 max-w-sm mx-auto">
                  Only registered wallet owners can participate. We will verify your account.
                </p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Registered Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3.5 text-slate-100 placeholder-slate-700 text-sm font-semibold tracking-wider text-center focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                {errorText && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorText}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    className="flex-[2] py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/15 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Verify Mobile</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3 & 4: TELEGRAM BOT INSTRUCTIONS & OTP ENTRY */}
          {(step === 3 || step === 4) && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400 mx-auto">
                  <Bot className="w-6 h-6 animate-bounce text-sky-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Bot OTP Sent!</h3>
                <p className="text-xs text-slate-450 max-w-sm mx-auto">
                  We have sent your 6-digit Feedback OTP to your registered Roy Share Telegram Bot.
                </p>
              </div>

              {/* Bot Launch link */}
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-2.5 text-center">
                <p className="text-[11px] text-slate-400">
                  Open your Telegram App, locate our official bot, and copy the code.
                </p>
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold hover:bg-sky-500/30 transition"
                  onClick={() => setStep(4)} // Advance user step state when clicked
                >
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>Launch Telegram Bot</span>
                </a>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-2xl px-4 py-3.5 text-slate-100 placeholder-slate-800 text-sm font-extrabold tracking-[0.25em] text-center focus:outline-none focus:border-sky-500 transition"
                  />
                  <p className="text-[10px] text-slate-550 text-center">OTP is valid for 5 minutes only.</p>
                </div>

                {errorText && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorText}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp}
                    className="flex-[2] py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-500/15 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Verify OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 5: FEEDBACK SURVEY FORM */}
          {step === 5 && verifiedUser && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Feedback Questionnaire</h3>
                  <p className="text-[11px] text-slate-500">Logged in as: <b className="text-sky-400">{verifiedUser.name}</b></p>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-slate-950 text-[10px] font-mono text-slate-500">
                  Step 5 of 5
                </span>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                {/* 1. Rating */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    1. Rate Your Experience with Roy Share Wallet
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => setRating(stars)}
                        className="p-1 text-slate-700 hover:text-amber-400 focus:outline-none transition group"
                      >
                        <Star
                          className={`w-8 h-8 sm:w-10 sm:h-10 transition ${
                            stars <= rating
                              ? 'text-amber-400 fill-amber-400 scale-110'
                              : 'text-slate-700 hover:scale-105'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-sm font-bold text-amber-400 ml-2 font-mono">({rating}/5)</span>
                  </div>
                </div>

                {/* 2. Category selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    2. Choose Feedback Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'wallet', label: '💰 Wallet Balance' },
                      { key: 'referral', label: '🤝 Referral Rewards' },
                      { key: 'withdraw', label: '💸 Withdrawals' },
                      { key: 'ui', label: '🎨 User Interface' },
                      { key: 'speed', label: '⚡ Performance' },
                      { key: 'support', label: '📞 Helpdesk Support' },
                    ].map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setCategory(cat.key as any)}
                        className={`py-3 px-4 rounded-xl border text-left text-xs font-semibold transition ${
                          category === cat.key
                            ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 shadow-sm'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    3. Feedback Headline
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. UPI withdrawal is super fast and easy!"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-sky-500 text-xs sm:text-sm"
                  />
                </div>

                {/* 4. Message details */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    4. Message / Suggestions (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share any additional thoughts or specific details to help us improve..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-sky-500 text-xs sm:text-sm resize-none"
                  />
                </div>

                {/* 5. Screenshot Upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    5. Upload Screenshot (Optional)
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-2xl p-4 text-center cursor-pointer bg-slate-950 transition ${
                      screenshotBase64
                        ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      id="screenshot-file-input"
                      onChange={handleScreenshotSelect}
                      className="hidden"
                    />

                    {screenshotBase64 ? (
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={screenshotBase64}
                            alt="Preview"
                            className="w-10 h-10 object-cover rounded-lg border border-slate-800"
                          />
                          <div className="text-left max-w-[200px] sm:max-w-xs truncate">
                            <span className="text-xs font-semibold text-slate-300">{screenshotName}</span>
                            <p className="text-[10px] text-slate-500">Image loaded successfully</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearScreenshot}
                          className="p-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="screenshot-file-input" className="cursor-pointer space-y-1.5 block">
                        <Upload className="w-6 h-6 text-slate-500 mx-auto" />
                        <div>
                          <span className="text-xs font-semibold text-sky-400 hover:underline">Click to upload</span>
                          <span className="text-xs text-slate-500"> or drag and drop</span>
                        </div>
                        <p className="text-[10px] text-slate-650">PNG, JPG or JPEG up to 5MB</p>
                      </label>
                    )}
                  </div>
                </div>

                {/* Verification Shield tag */}
                <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-850 rounded-xl text-[10px] text-slate-500">
                  <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Authorized wallet transaction security protocols active. One submission per verified campaign.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-sky-500/15 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isSubmittingFeedback ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Submitting feedback...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Feedback survey</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 6: SUCCESS / THANK YOU */}
          {step === 6 && (
            <div className="text-center space-y-6 py-4 animate-scaleIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">Submission Approved</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {campaign?.thankYouMessage || 'Thank you for helping Roy Share Wallet.'}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-1.5 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500">Participation Status</span>
                <p className="text-xs font-semibold text-slate-300">
                  Pending Moderator Approval for <b className="text-emerald-400">₹{campaign?.bonusAmount}</b>.
                </p>
                <p className="text-[10px] text-slate-500">
                  Once approved, your bonus is credited instantly and a notification is sent to your Telegram Bot.
                </p>
              </div>

              <div className="text-[11px] text-slate-600 border-t border-slate-800/80 pt-4 max-w-xs mx-auto">
                You can now safely close this browser window or return to Telegram.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
