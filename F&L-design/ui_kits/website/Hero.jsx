/* global React */
function Hero({ data }) {
  return (
    <section style={{
      padding: '96px 0 72px',
      borderBottom: '1px solid var(--ink-08)',
      backgroundImage: "url('../../assets/pattern-frame.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, alignItems: 'end' }}>
        <h1 style={{
          fontFamily: "'Sharp Grotesk', sans-serif", fontWeight: 600,
          fontSize: 'clamp(48px, 6vw, 84px)', lineHeight: 1.02,
          letterSpacing: '-0.025em', margin: 0, color: 'var(--blue)',
          textWrap: 'balance',
        }}>
          Makers van content,<br/>
          liefhebbers van magazines
        </h1>
        <p style={{
          fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 17, lineHeight: 1.6,
          color: 'var(--ink-2)', margin: 0, paddingBottom: 8, textWrap: 'pretty',
        }}>{data.hero.body}</p>
      </div>
    </section>
  );
}

window.Hero = Hero;
