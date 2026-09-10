import { Link } from "react-router-dom";
import { Search, User, Calendar, Tag } from "lucide-react";
import { usePosts, useRecentPosts, useTags, formatPostDate } from "../modules/content";
import { CatalogueError } from "../components/CatalogueState";
import Picture from "../shared/ui/Picture";

/**
 * The blog listing and its sidebar.
 *
 * Everything here now comes from GET /api/posts. Previously the posts were declared inside
 * the component body (reallocated every render), the "Recent posts" panel showed five
 * copies of "Sample blog title here" dated 03 Aug 2022, and the category counts were
 * invented — Crafts 2, Design 8, Handmade 7, Wood 6 — against three real posts. All of that
 * shipped to production.
 */

const PostSkeleton = () => (
  <div className="bg-white rounded-xl p-6 space-y-6 animate-pulse" aria-busy="true">
    <div className="h-8 w-2/3 bg-gray-200 rounded" />
    <div className="h-4 w-full bg-gray-200 rounded" />
    <div className="h-4 w-5/6 bg-gray-200 rounded" />
    <div className="h-64 w-full bg-gray-200 rounded-xl" />
  </div>
);

const BlogSection = () => {
  const { posts, loading, error, retry } = usePosts({ limit: 3 });
  const { posts: recent } = useRecentPosts();
  const { tags } = useTags();

  return (
    <section className="bg-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ===== LEFT SIDE - Blog Posts ===== */}
        <div className="lg:col-span-2 space-y-10">
          {error ? (
            <CatalogueError error={error} onRetry={retry} />
          ) : loading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : posts.length === 0 ? (
            <p className="text-gray-500 py-16 text-center">No posts yet.</p>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-xl overflow-hidden shadow-sm space-y-6 p-6"
              >
                <h2 className="text-3xl font-semibold">
                  <Link to={`/blog/${post.slug}`} className="hover:text-[#B88E2F] transition">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-500 leading-relaxed">{post.excerpt}</p>

                <Link
                  to={`/blog/${post.slug}`}
                  className="inline-block border-b border-black pb-1 text-sm font-medium hover:text-[#B88E2F] hover:border-[#B88E2F] transition"
                >
                  Read more
                </Link>

                <Picture
                  src={post.image.src}
                  webp={post.image.webp}
                  avif={post.image.avif}
                  alt={post.title}
                  loading="lazy"
                  className="w-full rounded-xl object-cover"
                />

                <div className="flex flex-wrap items-center gap-8 text-gray-500 text-sm">
                  <div className="flex items-center gap-2">
                    <User size={16} /> {post.author}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <time dateTime={post.published_at}>{formatPostDate(post.published_at)}</time>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag size={16} /> {post.tag}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* ===== RIGHT SIDE - Sidebar ===== */}
        <div className="space-y-10">
          {/* Search — no handler yet; see CHANGELOG.md#known-issues */}
          <div className="bg-white p-5 rounded-xl shadow-sm">
            <div className="relative">
              <label className="sr-only" htmlFor="blog-search">Search the blog</label>
              <input
                id="blog-search"
                type="search"
                placeholder="Search..."
                className="w-full border border-gray-300 rounded-lg py-2 px-4 pr-10 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <Search
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>

          {/* Categories — counts derived from the posts, so they cannot be wrong */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Categories</h3>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-600">No categories yet.</p>
            ) : (
              <ul className="space-y-4 text-gray-600">
                {tags.map((tag) => (
                  <li key={tag.slug} className="flex justify-between">
                    <span>{tag.name}</span>
                    <span>{tag.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent posts — real posts, not five copies of a placeholder */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Recent Posts</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-gray-600">Nothing published yet.</p>
            ) : (
              <ul className="space-y-6">
                {recent.map((post) => (
                  <li key={post.id}>
                    <Link to={`/blog/${post.slug}`} className="flex gap-4 items-center group">
                      <Picture
                        src={post.image.src}
                        webp={post.image.webp}
                  avif={post.image.avif}
                        alt=""
                        loading="lazy"
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium leading-snug group-hover:text-[#B88E2F] transition">
                          {post.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          <time dateTime={post.published_at}>
                            {formatPostDate(post.published_at)}
                          </time>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BlogSection;
