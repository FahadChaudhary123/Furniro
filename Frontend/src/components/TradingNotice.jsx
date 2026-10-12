const TradingNotice = ({ className = '' }) => (
  <p className={`rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}>
    Catalogue prices are shown in IDR. Pakistan prices in PKR and ordering are not available yet.
  </p>
);

export default TradingNotice;
