/**
 * An image that offers WebP with the original as a fallback.
 *
 * Doc B §15 requires modern formats served. A static host cannot content-negotiate, so the
 * choice has to be expressed in markup: the browser picks the first `<source>` it can
 * decode and falls back to the `<img>`, which stays the accessible, right-clickable,
 * lazy-loadable element.
 *
 * Sizing matters more than format here — correcting intrinsic dimensions to the box each
 * image renders into saved 42% of image weight, against 25% for the format change. Both are
 * worth having, but a `<picture>` wrapped around an oversized file is still an oversized
 * file. See scripts/image-display-widths.mjs.
 *
 * Falls back to a plain `<img>` when no WebP exists, so a newly added image works before
 * anyone runs the optimiser.
 */
const Picture = ({ src, webp, alt = '', className, loading, ...rest }) => {
  const img = (
    <img src={src} alt={alt} className={className} loading={loading} {...rest} />
  );

  if (!webp) return img;

  return (
    <picture>
      <source srcSet={webp} type="image/webp" />
      {img}
    </picture>
  );
};

export default Picture;
