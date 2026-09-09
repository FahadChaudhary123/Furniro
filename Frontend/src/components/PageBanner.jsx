import { Link } from 'react-router-dom';
import logoIcon from '../assets/logo.svg';
import bannerImg from '../assets/contactBanner.jpg';

/**
 * The banner strip with a title and breadcrumb trail.
 *
 * The single banner. `ShopBanner`, `BlogBanner` and an inline block on the contact page each
 * hand-rolled this same markup with a different string; all three are gone.
 *
 * Folding them in was an accessibility fix as much as a deduplication. Each copy rendered its
 * breadcrumb as a plain `<p>` — "Home > Shop" as text, with no link back and nothing marking
 * the current page — and labelled the decorative logo `alt="icon"`, which a screen reader
 * reads aloud. This renders a real `<nav aria-label="Breadcrumb">` with working links and
 * `aria-current="page"`, and hides the logo from assistive technology.
 *
 * @param {string} title
 * @param {{label: string, to?: string}[]} trail - breadcrumb, last item is the current page
 */
const PageBanner = ({ title, trail = [] }) => (
  <section
    className="relative w-full h-[280px] md:h-[150px] bg-cover bg-center flex items-center justify-center"
    style={{ backgroundImage: `url(${bannerImg})` }}
  >
    <div className="absolute inset-0 bg-white/40" />

    <div className="relative z-10 text-center px-4">
      <div className="flex justify-center mb-3">
        {/* Decorative. `alt=""` tells a screen reader to skip it; `aria-hidden` says the
            same thing again, which is what quality.spec.js requires of a standalone image
            with no alt text — an empty alt alone is indistinguishable from a forgotten one
            when scanning a page automatically. */}
        <img src={logoIcon} alt="" aria-hidden="true" className="w-8 h-8" />
      </div>

      <h1 className="text-3xl md:text-4xl font-semibold text-black">{title}</h1>

      {trail.length > 0 && (
        <nav aria-label="Breadcrumb" className="mt-2 text-sm md:text-base text-gray-700">
          {trail.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`}>
              {i > 0 && <span className="mx-1">&gt;</span>}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-[#B88E2F] transition">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
    </div>
  </section>
);

export default PageBanner;
