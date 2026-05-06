/* global React */
const { useState } = React;

function Logo({ size = 'md' }) {
  const h = size === 'sm' ? 22 : size === 'lg' ? 44 : 30;
  return (
    <a href="#" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', borderBottom: 0 }}>
      <img src="../../assets/logo-horizontal.svg" alt="F&L Media" style={{ height: h, display: 'block' }} />
    </a>
  );
}

function Header({ data, activeSection, onNav }) {
  const [open, setOpen] = useState(false);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--ink-08)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <Logo />
          <nav style={{ display: 'flex', gap: 26 }}>
            {data.nav.map(n => {
              const isActive = activeSection === n.href.replace('#','');
              return (
                <a key={n.label} href={n.href}
                  onClick={(e) => { e.preventDefault(); onNav?.(n.href.replace('#','')); }}
                  style={{
                    fontFamily: "'Sharp Grotesk', sans-serif", fontSize: 14, fontWeight: 500,
                    color: isActive ? 'var(--blue)' : 'var(--ink)',
                    textDecoration: 'none', borderBottom: 0,
                    transition: 'color 150ms var(--ease)',
                  }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--blue)'}
                  onMouseOut={e => e.currentTarget.style.color = isActive ? 'var(--blue)' : 'var(--ink)'}
                >{n.label}</a>
              );
            })}
          </nav>
        </div>
        <button className="btn" style={{ padding: '10px 18px', fontSize: 13 }}
          onClick={() => onNav?.('merken')}>Adverteren →</button>
      </div>
    </header>
  );
}

window.Logo = Logo;
window.Header = Header;
