/* global React */

function BrandTile({ brand, accent }) {
  return (
    <a href="#" style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      background: accent ? 'var(--blue)' : 'var(--paper)',
      color: accent ? 'var(--paper)' : 'var(--blue)',
      border: accent ? '1px solid var(--blue)' : '1px solid var(--ink-08)',
      padding: 28, minHeight: 200, borderRadius: 8,
      textDecoration: 'none', borderBottom: accent ? '1px solid var(--blue)' : '1px solid var(--ink-08)',
      transition: 'transform 300ms var(--ease), background 300ms var(--ease), border-color 300ms var(--ease)',
    }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        if (!accent) e.currentTarget.style.borderColor = 'var(--blue)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        if (!accent) e.currentTarget.style.borderColor = 'var(--ink-08)';
      }}
    >
      <span style={{
        fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 11, fontWeight: 500,
        letterSpacing: '0.06em', textTransform: 'lowercase',
        opacity: 0.75,
      }}>{brand.tag}</span>
      <h3 style={{
        fontFamily: "'Sharp Grotesk', sans-serif", fontWeight: 600,
        fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.02em',
        margin: 0, color: 'inherit',
      }}>{brand.name}</h3>
    </a>
  );
}

function BrandsSection({ data }) {
  return (
    <section id="merken" style={{ padding: '80px 0', background: 'var(--blue-pale)', borderTop: '1px solid var(--ink-08)', borderBottom: '1px solid var(--ink-08)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 56, marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Sharp Grotesk', sans-serif", fontWeight: 600, fontSize: 56, lineHeight: 1.02, letterSpacing: '-0.025em', margin: 0, color: 'var(--blue)' }}>Merken</h2>
          <p style={{ fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 17, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            Met onze magazinemerken bereiken we miljoenen mensen met dezelfde passie voor: koken, computers, geschiedenis, auto's, tuinieren, politiek en filosofie. We delen hun interesses en helpen ze verder.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {data.brands.map((b, i) => (
            <BrandTile key={b.name} brand={b} accent={i === 4} />
          ))}
        </div>
      </div>
    </section>
  );
}

window.BrandTile = BrandTile;
window.BrandsSection = BrandsSection;
