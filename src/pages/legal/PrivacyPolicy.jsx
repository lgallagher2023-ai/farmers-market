import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Privacy Policy</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Last Updated: July 3, 2026</p>

          <p className="text-sm text-gray-600 leading-relaxed">
            This Privacy Policy describes how Market collects, uses, and shares information about you when you use our Platform.
          </p>

          <Section title="Information We Collect">
            <ul>
              <li>Account information including name, email, password, and phone number</li>
              <li>Profile information including zip code, product preferences, fulfillment preferences, and optional date of birth</li>
              <li>Vendor information including business name, description, type, address, and social media links</li>
              <li>Survey responses from onboarding</li>
              <li>Payment billing information processed by Stripe</li>
              <li>Usage data including pages visited, products viewed, searches, clicks, and time on page</li>
              <li>Device information including device type and browser</li>
              <li>Approximate location from IP address or zip code</li>
              <li>Transaction data including orders and purchase history</li>
              <li>Behavioral data including follows, cart activity, and interactions</li>
            </ul>
          </Section>

          <Section title="How We Use Your Information">
            <ul>
              <li>To provide and manage your account and process orders</li>
              <li>To personalize your experience with relevant vendor and product recommendations</li>
              <li>To send order updates and market appearance notifications</li>
              <li>To improve the Platform</li>
              <li>To detect fraud and enforce our Terms</li>
              <li>To comply with applicable laws</li>
              <li>To respond to support requests</li>
            </ul>
          </Section>

          <Section title="How We Share Your Information">
            <ul>
              <li>With Vendors to fulfill your orders</li>
              <li>With service providers including Stripe for payment processing, Supabase for database hosting, Vercel for application hosting, and Anthropic for AI features</li>
              <li>For legal compliance when required by law</li>
              <li>In connection with a business transfer or acquisition</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </Section>

          <Section title="Personalization & Advertising">
            <p>We use your preferences, purchase history, and behavioral data to show personalized vendor recommendations and promotional content. Vendors may pay to promote their listings to relevant users. We do not share your personal data directly with advertisers.</p>
          </Section>

          <Section title="Data Retention & Security">
            <p>We retain your information as long as your account is active. We implement reasonable security measures including encryption and access controls, but cannot guarantee absolute security.</p>
          </Section>

          <Section title="Your Rights">
            <p>You may have rights to access, correct, delete, or port your personal information. To exercise these rights, contact us at{' '}
              <a href="mailto:support@marketplatform.com" className="text-brand-600 hover:underline">support@marketplatform.com</a>.
              You may opt out of marketing communications at any time through your account settings.
            </p>
          </Section>

          <Section title="Children's Privacy">
            <p>The Platform is not directed to children under 13. We do not knowingly collect information from children under 13.</p>
          </Section>

          <Section title="Changes to This Policy">
            <p>We may update this Privacy Policy at any time. Continued use of the Platform constitutes acceptance of changes.</p>
          </Section>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Contact:{' '}
              <a href="mailto:support@marketplatform.com" className="text-brand-600 hover:underline">
                support@marketplatform.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  )
}
