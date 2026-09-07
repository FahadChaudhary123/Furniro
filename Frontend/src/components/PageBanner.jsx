import { Link } from 'react-router-dom';
import logoIcon from '../assets/logo.svg';
import bannerImg from '../assets/contactBanner.jpg';

/**
 * The banner strip with a title and breadcrumb trail.
 *
 * `ShopBanner`, `BlogBanner` and the contact page each hand-roll this same markup with a
 * different string. Those are left alone for now — changing them is a separate cleanup with
 * its own review — but new pages use this rather than adding a fourth copy.
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
        <img src={logoIcon} alt="" className="w-8 h-8" />
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
