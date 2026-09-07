import { Link } from 'react-router-dom';
import PageBanner from '../components/PageBanner';
import Footer from '../components/Footer';
import { useDocumentTitle } from '../shared/lib/useDocumentTitle';

/**
 * Catch-all for unmatched routes.
 *
 * Without this an unknown path rendered the navbar and nothing else — a blank page that
 * reads as a broken site rather than a wrong address. Doc B §15 is explicit that an indexed
 * URL should never land on a bare 404, so this offers a route onward rather than a dead end.
 */
const NotFound = () => {
  useDocumentTitle('Page not found');

  return (
    <div>
      <PageBanner title="404" trail={[{ label: 'Home', to: '/' }, { label: 'Not found' }]} />

      <section className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold text-gray-900">This page does not exist</h2>
        <p className="mt-4 text-gray-600">
          The address may be mistyped, or the page may have moved.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            to="/"
            className="bg-[#B88E2F] text-white px-8 py-3 font-semibold hover:bg-[#a57924] transition"
          >
            Back to home
          </Link>
          <Link
            to="/shop"
            className="border border-[#B88E2F] text-[#B88E2F] px-8 py-3 font-semibold hover:bg-[#B88E2F] hover:text-white transition"
          >
            Browse the shop
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default NotFound;
