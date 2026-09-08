import { useParams, Link } from 'react-router-dom';
import { User, Calendar, Tag } from 'lucide-react';
import { usePost, formatPostDate } from '../modules/content';
import { usePageMeta } from '../shared/lib/usePageMeta.js';
import PageBanner from '../components/PageBanner';
import { CatalogueError } from '../components/CatalogueState';
import FeaturesSection from '../sections/FeaturesSection';
import Footer from '../components/Footer';
import Picture from '../shared/ui/Picture';

/**
 * A single blog post — the first consumer of GET /api/posts/:slug.
 *
 * The body is stored as plain text with blank-line paragraph breaks and rendered by
 * splitting on them. It is NOT passed to dangerouslySetInnerHTML: the moment posts become
 * CMS-authored, that would be a stored-XSS route. If rich text is needed, sanitise
 * server-side and render through a parser, not by injecting HTML.
 */
const BlogPost = () => {
  const { slug } = useParams();
  const { post, notFound, loading, error, retry } = usePost(slug);

  // Placeholder posts are noindex, matching their exclusion from the sitemap. Excluding a
  // page from the sitemap does not stop it being indexed — three pages link to each of
  // these, so a crawler finds them regardless. Without this the sitemap rule is decorative.
  // Clearing `_placeholder` in posts.json is what makes a post indexable, in both places.
  usePageMeta({
    title: post?.title ?? (notFound ? 'Post not found' : 'Blog'),
    description: post?.excerpt ?? post?.body?.slice(0, 150),
    path: `/blog/${slug}`,
    index: Boolean(post) && !post._placeholder,
  });

  const paragraphs = post?.body ? post.body.split(/\n\s*\n/).filter(Boolean) : [];

  return (
    <div>
      <PageBanner
        title={post?.title ?? (notFound ? 'Not found' : 'Blog')}
        trail={[
          { label: 'Home', to: '/' },
          { label: 'Blog', to: '/about' },
          { label: post?.title ?? slug },
        ]}
      />

      <section className="max-w-3xl mx-auto px-4 py-16">
        {error ? (
          <CatalogueError error={error} onRetry={retry} />
        ) : notFound ? (
          <div className="text-center py-16" role="alert">
            <h2 className="text-2xl font-semibold text-gray-900">Post not found</h2>
            <p className="mt-3 text-gray-600">No article matches “{slug}”.</p>
            <Link
              to="/about"
              className="mt-8 inline-block bg-[#B88E2F] text-white px-8 py-3 font-semibold hover:bg-[#a57924] transition"
            >
              Back to the blog
            </Link>
          </div>
        ) : loading ? (
          <div className="space-y-6 animate-pulse" aria-busy="true">
            <div className="h-10 w-3/4 bg-gray-200 rounded" />
            <div className="h-64 w-full bg-gray-200 rounded-xl" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-5/6 bg-gray-200 rounded" />
          </div>
        ) : (
          <article>
            <h2 className="text-3xl font-semibold text-gray-900">{post.title}</h2>

            <div className="mt-4 flex flex-wrap items-center gap-6 text-gray-500 text-sm">
              <span className="flex items-center gap-2">
                <User size={16} /> {post.author}
              </span>
              <span className="flex items-center gap-2">
                <Calendar size={16} />
                <time dateTime={post.published_at}>{formatPostDate(post.published_at)}</time>
              </span>
              <span className="flex items-center gap-2">
                <Tag size={16} /> {post.tag}
              </span>
            </div>

            <Picture
              src={post.image.src}
              webp={post.image.webp}
              alt={post.title}
              className="w-full rounded-xl object-cover mt-8"
            />

            <div className="mt-10 space-y-6 text-gray-600 leading-relaxed">
              {paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <p className="mt-12">
              <Link to="/about" className="text-sm text-gray-500 hover:text-[#B88E2F] transition">
                ← Back to the blog
              </Link>
            </p>
          </article>
        )}
      </section>

      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default BlogPost;
