/* global React, Card */

function MagazineGrid({ data }) {
  // Asymmetric magazine spread: mix of 1- and 2-col cards.
  const layout = [
    { i: 0, span: 2, h: 320 },
    { i: 1, span: 1, h: 320 },
    { i: 2, span: 1, h: 280 },
    { i: 3, span: 1, h: 280 },
    { i: 4, span: 2, h: 280 },
    { i: 5, span: 1, h: 240 },
    { i: 6, span: 1, h: 240 },
    { i: 7, span: 1, h: 240 },
    { i: 8, span: 1, h: 280 },
    { i: 9, span: 2, h: 280 },
    { i: 10, span: 1, h: 280 },
    { i: 11, span: 1, h: 220 },
    { i: 12, span: 2, h: 220 },
    { i: 13, span: 1, h: 220 },
    { i: 14, span: 1, h: 260 },
    { i: 15, span: 1, h: 260 },
  ];
  return (
    <section id="nieuws" style={{ padding: '72px 0' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32 }}>
          <h2 style={{ fontFamily: "'Sharp Grotesk', sans-serif", fontWeight: 600, fontSize: 40, letterSpacing: '-0.02em', margin: 0, color: 'var(--blue)' }}>Nieuws &amp; merken</h2>
          <a href="#" style={{ fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--blue)', borderBottom: '1px solid var(--blue-soft)', textDecoration: 'none', paddingBottom: 2 }}>Alles bekijken →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, gridAutoFlow: 'dense' }}>
          {layout.map(({ i, span, h }) => data.cards[i] && <Card key={i} data={data.cards[i]} span={span} height={h} />)}
        </div>
      </div>
    </section>
  );
}

window.MagazineGrid = MagazineGrid;
