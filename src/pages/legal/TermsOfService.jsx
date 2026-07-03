import { useNavigate } from 'react-router-dom'

export default function TermsOfService() {
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
        <h1 className="text-lg font-bold text-gray-900">Terms of Service</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Last Updated: July 3, 2026</p>

          <Section title="About Market">
            <p>Market is an online marketplace that connects independent vendors with customers for the purpose of discovering, ordering, and purchasing goods at local farmers markets. Market is a marketplace intermediary only. We do not manufacture, produce, store, inspect, or sell any goods listed on the Platform. All goods are sold directly by independent Vendors. Market is not a party to any transaction between Vendors and Customers.</p>
            <p>By accessing or using the Platform, you confirm that you are at least 18 years of age and agree to be legally bound by these Terms.</p>
          </Section>

          <Section title="Vendor Independence">
            <p>VENDORS ARE INDEPENDENT THIRD PARTIES. Vendors are not employees, agents, partners, or representatives of Market. Market does not control, supervise, direct, or monitor Vendors' business operations, production methods, product quality, pricing, or fulfillment practices.</p>
            <p>Vendors are solely and exclusively responsible for:</p>
            <ul>
              <li>The accuracy and completeness of all product listings</li>
              <li>The quality, safety, fitness for purpose, and legality of all goods they sell</li>
              <li>Compliance with all applicable federal, state, and local laws and regulations governing the production, labeling, sale, and distribution of their products, including food safety laws, health codes, cottage food regulations, and agricultural laws</li>
              <li>Obtaining all required licenses, permits, certifications, and inspections</li>
              <li>Accurate disclosure of all ingredients, allergens, and materials</li>
              <li>Proper handling, storage, preparation, packaging, and delivery of all goods</li>
              <li>Any harm, injury, illness, damage, or loss arising from their products or services</li>
            </ul>
          </Section>

          <Section title="Food Safety & Allergen Notice">
            <p>Customers who purchase food, beverages, or other consumable products do so at their own risk. Market makes no representations or warranties regarding the safety, quality, ingredients, allergen content, preparation methods, or fitness for consumption of any food or consumable product.</p>
            <p className="font-semibold text-gray-800">If you have food allergies, dietary restrictions, or health conditions, you must independently verify all ingredient and allergen information directly with the Vendor before purchasing. Do not rely solely on product listings.</p>
          </Section>

          <Section title="No Endorsement">
            <p>The listing of any Vendor or product on the Platform does not constitute an endorsement, recommendation, or guarantee by Market. Market does not independently verify, inspect, audit, or certify any Vendor's products, licenses, permits, or regulatory compliance. Approval on the Platform does not constitute any certification of product quality, safety, or regulatory compliance.</p>
          </Section>

          <Section title="Disclaimer of Warranties">
            <p className="uppercase text-xs leading-relaxed text-gray-700">The Platform is provided on an "as is" and "as available" basis without warranties of any kind. Market expressly disclaims all warranties including implied warranties of merchantability and fitness for a particular purpose.</p>
          </Section>

          <Section title="Limitation of Liability">
            <p className="uppercase text-xs leading-relaxed text-gray-700">To the maximum extent permitted by applicable law, Market shall not be liable for any indirect, incidental, special, consequential, or punitive damages including: personal injury or property damage from goods purchased through the Platform; illness or adverse reactions from consuming products purchased through the Platform; loss of profits or revenue; or any damages arising from Vendor misconduct, misrepresentation, or negligence. Market's total liability shall not exceed the greater of the platform fees you paid in the three months preceding the claim or one hundred dollars ($100).</p>
          </Section>

          <Section title="Indemnification">
            <p>You agree to defend, indemnify, and hold harmless Market and its officers, directors, employees, and agents from any claims, damages, losses, and expenses arising from:</p>
            <ul>
              <li>Your use of the Platform</li>
              <li>Your violation of these Terms</li>
              <li>If you are a Vendor, any claim arising from your products, including personal injury, illness, property damage, product liability, misrepresentation, or violation of any food safety or consumer protection law</li>
              <li>Any transaction or dispute between you and another user</li>
            </ul>
          </Section>

          <Section title="Vendor Requirements">
            <p>Vendors must be approved by Market before listing products. By registering as a Vendor, you represent and warrant that:</p>
            <ul>
              <li>You have all necessary licenses and permits to sell your products</li>
              <li>All product information is accurate and not misleading</li>
              <li>Your products comply with all applicable laws</li>
              <li>You will accurately disclose all ingredients and allergens</li>
              <li>You will handle and deliver goods in accordance with all applicable health and food safety requirements</li>
            </ul>
          </Section>

          <Section title="Payments & Refunds">
            <p>Payments are processed through Stripe. Market charges a platform fee on each transaction, disclosed at checkout. Refund policies are set by individual Vendors. Market is not responsible for disputes between Vendors and Customers, but may at its sole discretion assist in mediation.</p>
          </Section>

          <Section title="Governing Law & Disputes">
            <p>These Terms are governed by the laws of the State of New Jersey. Any disputes shall be resolved by binding arbitration in New Jersey. You waive any right to participate in a class action.</p>
          </Section>

          <Section title="Changes to These Terms">
            <p>We reserve the right to modify these Terms at any time. Continued use of the Platform constitutes acceptance of revised Terms.</p>
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
