/* global React */

// All cards live in the F&L corporate identity — navy on white, with a few
// brand-soft and brand-deep variants. Magazine sub-brand colors live elsewhere.
const TONES = {
  blue:   { bg: '#004077', fg: '#FFFFFF' },        // primary brand
  deep:   { bg: '#001E3B', fg: '#FFFFFF' },        // deepest blue
  soft:   { bg: '#DCE7F0', fg: '#004077' },        // soft tint
  pale:   { bg: '#F0F4F8', fg: '#004077' },        // pale wash
  paper:  { bg: '#FFFFFF', fg: '#001E3B' },        // white card with hairline
};

function Tags({ tags, fg }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
      {tags.map(t => (
        <span key={t} style={{
          fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 11, fontWeight: 500,
          letterSpacing: '0.06em', textTransform: 'lowercase',
          color: fg, opacity: 0.75,
        }}>{t}</span>
      ))}
    </div>
  );
}

function Card({ data, span = 1, height = 280 }) {
  // Map any legacy tone names to the new blue-only palette
  const toneKey = ['warm','cream','ochre'].includes(data.tone) ? 'paper'
    : ['rose'].includes(data.tone) ? 'soft'
    : ['ink','tech','garden'].includes(data.tone) ? 'deep'
    : ['accent'].includes(data.tone) ? 'blue'
    : (TONES[data.tone] ? data.tone : 'paper');
  const tone = TONES[toneKey];
  const isPaper = toneKey === 'paper';
  return (
    <a href="#" style={{
      gridColumn: `span ${span}`,
      background: tone.bg,
      borderRadius: 8,
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: height,
      textDecoration: 'none', borderBottom: 0,
      border: isPaper ? '1px solid var(--ink-08)' : '1px solid transparent',
      boxShadow: '0 1px 2px rgba(0,30,59,.04), 0 8px 24px rgba(0,30,59,.06)',
      transition: 'transform 300ms var(--ease), box-shadow 300ms var(--ease)',
      overflow: 'hidden',
      position: 'relative',
    }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,30,59,.06), 0 14px 32px rgba(0,30,59,.10)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,30,59,.04), 0 8px 24px rgba(0,30,59,.06)';
      }}
    >
      <Tags tags={data.tags} fg={tone.fg} />
      <h3 style={{
        fontFamily: "'Sharp Grotesk', sans-serif", fontWeight: 600,
        fontSize: span === 2 ? 28 : 22, lineHeight: 1.18,
        letterSpacing: '-0.02em', margin: 0, color: tone.fg, textWrap: 'balance',
      }}>{data.title}</h3>
    </a>
  );
}

window.Card = Card;
