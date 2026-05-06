/* global React, Logo */

function Footer({ data }) {
  const h4 = { fontFamily: "'Sharp Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--blue)', margin: '0 0 14px' };
  const body = { fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 };
  const link = { fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none', borderBottom: 0 };
  return (
    <footer id="contact" style={{ background: 'var(--paper)', padding: '64px 0 32px', borderTop: '1px solid var(--ink-12)' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, alignItems: 'start' }}>
        <div>
          <Logo />
          <p style={{ ...body, marginTop: 18, maxWidth: 320 }}>
            Goede en betrouwbare content, en plezier in ons werk staan aan de basis van alles wat we doen.
          </p>
        </div>
        <div>
          <h4 style={h4}>Kom langs!</h4>
          <p style={body}>
            {data.brand.address.street}<br/>
            {data.brand.address.city}<br/>
            <a href={`tel:${data.brand.phone.replace(/\s/g,'')}`} style={{ ...link, color: 'var(--ink)', borderBottom: '1px solid var(--ink-12)' }}>{data.brand.phone}</a><br/>
            <a href={`mailto:${data.brand.email}`} style={{ ...link, color: 'var(--ink)', borderBottom: '1px solid var(--ink-12)' }}>{data.brand.email}</a>
          </p>
        </div>
        <div>
          <h4 style={h4}>Over F&amp;L</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.footer.overFL.map(l => (
              <li key={l.label}><a href={l.href} style={link}>{l.label}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 style={h4}>Volg ons</h4>
          <a href="https://nl.linkedin.com/company/fnl-media" style={link}>LinkedIn ↗</a>
        </div>
      </div>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--ink-12)' }}>
        <span style={{ fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 12, color: 'var(--ink-3)' }}>© 2026 — F&amp;L Media</span>
        <div style={{ display: 'flex', gap: 22 }}>
          {data.footer.legal.map(l => (
            <a key={l.label} href={l.href} style={{ fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none', borderBottom: 0 }}>{l.label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

window.Footer = Footer;
