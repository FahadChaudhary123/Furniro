import { Link, useSearchParams } from "react-router-dom";
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
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const selectedTag = params.get("tag");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { posts, meta, loading, error, retry } = usePosts({ page, limit: 3, tag: selectedTag, q });
  const { posts: recent } = useRecentPosts();
  const { tags } = useTags();
  const pageOutOfRange = Boolean(meta && page > meta.total_pages);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    if (!Object.hasOwn(changes, "page")) next.delete("page");
    setParams(next);
  };

  return (
    <section className="bg-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* ===== LEFT SIDE - Blog Posts ===== */}
        <div className="lg:col-span-2 space-y-10">
          {error ? (
            <CatalogueError title="Posts could not be loaded" error={error} onRetry={retry} />
          ) : loading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : pageOutOfRange ? (
            <div className="py-16 text-center text-gray-600">
              <p>This blog page is no longer available.</p>
              <button onClick={() => update({ page: null })} className="mt-4 underline">
                Go to first page
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center text-gray-600">
              <p>{q || selectedTag ? "No posts match those filters." : "No posts yet."}</p>
              {(q || selectedTag) && (
                <button onClick={() => update({ q: null, tag: null })} className="mt-4 underline">
                  Clear blog filters
                </button>
              )}
            </div>
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
          {!error && !loading && !pageOutOfRange && meta?.total_pages > 1 && (
            <nav aria-label="Blog pages" className="flex justify-center gap-4">
              <button disabled={page <= 1} onClick={() => update({ page: page - 1 === 1 ? null : page - 1 })}
                className="rounded border px-4 py-2 disabled:opacity-50">Previous</button>
              <span className="self-center">Page {page} of {meta.total_pages}</span>
              <button disabled={page >= meta.total_pages} onClick={() => update({ page: page + 1 })}
                className="rounded border px-4 py-2 disabled:opacity-50">Next</button>
            </nav>
          )}
        </div>

        {/* ===== RIGHT SIDE - Sidebar ===== */}
        <div className="space-y-10">
          {/* Search and category filters share URL state for bookmarkable blog views. */}
          <div className="bg-white p-5 rounded-xl shadow-sm">
            <form role="search" className="relative" onSubmit={(event) => {
              event.preventDefault();
              update({ q: new FormData(event.currentTarget).get("q")?.toString().trim() || null });
            }}>
              <label className="sr-only" htmlFor="blog-search">Search the blog</label>
              <input
                id="blog-search"
                name="q"
                type="search"
                key={q}
                defaultValue={q}
                placeholder="Search..."
                className="w-full border border-gray-300 rounded-lg py-2 px-4 pr-10 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button type="submit" aria-label="Search blog posts"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-700 hover:bg-gray-100">
                <Search size={18} aria-hidden="true" />
              </button>
            </form>
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
                    <button onClick={() => update({ tag: tag.slug === selectedTag ? null : tag.slug })}
                      aria-pressed={tag.slug === selectedTag}
                      className="text-left hover:underline aria-pressed:font-semibold">
                      {tag.name}
                    </button>
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
