import type { ReactNode } from "react";

/** Rustige, scanbare infoblokken voor meeting-duiding. */
export function DuidingCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 shadow-sm ring-1 ring-sky-100/80">
      <h3 className="text-lg font-semibold tracking-tight text-sky-950">{title}</h3>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-sky-950/90 [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-sky-950/90 [&_li]:list-disc">
        {children}
      </div>
    </aside>
  );
}

export function BelangrijksteConclusiesBlok() {
  return (
    <section
      className="mb-12 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-white p-6 shadow-sm ring-1 ring-indigo-100 md:p-8"
      aria-labelledby="belangrijkste-conclusies-heading"
    >
      <h2
        id="belangrijkste-conclusies-heading"
        className="text-xl font-semibold tracking-tight text-indigo-950 md:text-2xl"
      >
        Belangrijkste conclusies
      </h2>
      <ul className="mt-5 list-none space-y-3.5 text-sm leading-relaxed text-indigo-950/95">
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-semibold tabular-nums text-indigo-600">1.</span>
          <span>
            Paywallviews liggen vanaf <strong className="font-semibold text-indigo-950">2025</strong> duidelijk
            lager dan in <strong className="font-semibold text-indigo-950">2024</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-semibold tabular-nums text-indigo-600">2.</span>
          <span>
            Abonneerkliks dalen niet even hard mee; de paywall-abonneerratio ligt in{" "}
            <strong className="font-semibold text-indigo-950">2025+</strong> hoger dan in{" "}
            <strong className="font-semibold text-indigo-950">2024</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-semibold tabular-nums text-indigo-600">3.</span>
          <span>
            De lagere instroom lijkt daarom eerder samen te hangen met minder paywall-exposure dan met een
            slechtere klikratio vanuit de paywall.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-semibold tabular-nums text-indigo-600">4.</span>
          <span>
            De piekmaanden januari en juni 2024 werden sterk gedragen door enkele artikelen en vooral door
            Email/nieuwsbrief; Organic Search speelde vooral in juni een grotere rol.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-semibold tabular-nums text-indigo-600">5.</span>
          <span>
            Nieuwsbrief-events vanuit artikelblokken dalen duidelijk per 1.000 pageviews; mobiel presteert
            doorgaans lager dan desktop.
          </span>
        </li>
      </ul>
    </section>
  );
}

export function DuidingOverzicht() {
  return (
    <DuidingCard title="Wat moet je hier zien?">
      <p>
        De paywall wordt minder vaak getoond, maar de mensen die de paywall zien klikken relatief vaker door.
        De indexgrafiek laat zien dat nieuw verkeer niet één-op-één de ontwikkeling van paywallviews verklaart:
        het gaat dus ook om welk verkeer op betaalde artikelen terechtkomt.
      </p>
      <ul>
        <li>
          Het probleem lijkt vooral <strong className="font-semibold">vóór de paywall</strong> te zitten:
          bereik, artikelmix of distributie.
        </li>
        <li>
          De paywallratio is <strong className="font-semibold">geen duidelijk alarmsignaal</strong>; die ligt
          juist hoger in 2025+.
        </li>
        <li>
          Nieuwe gebruikers zijn alleen waardevol voor instroom als ze op artikelen{" "}
          <strong className="font-semibold">met paywall</strong> landen.
        </li>
      </ul>
    </DuidingCard>
  );
}

export function DuidingMaandontwikkeling() {
  return (
    <DuidingCard title="Duiding maandontwikkeling">
      <p>
        Gebruik deze tabellen vooral als controlelaag. De grafieken tonen de trend; de tabellen laten de exacte
        maandwaarden en ratio’s zien.
      </p>
      <ul>
        <li>
          Kijk vooral naar <span className="font-mono text-xs">paywall_view</span>,{" "}
          <span className="font-mono text-xs">paywall_abonneren</span>,{" "}
          <span className="font-mono text-xs">paywall_abonneer_ratio</span> en{" "}
          <span className="font-mono text-xs">paywall_views_per_new_user</span>.
        </li>
        <li>
          De grote vraag is niet alleen hoeveel nieuw verkeer er is, maar{" "}
          <strong className="font-semibold">hoeveel paywallviews dat verkeer oplevert</strong>.
        </li>
      </ul>
    </DuidingCard>
  );
}

export function DuidingPiekmaanden() {
  return (
    <div className="space-y-5">
      <DuidingCard title="Duiding piekmaanden">
        <p>
          De piekmaanden lijken niet door één artikel te worden verklaard, maar door een groep sterke artikelen.
          In januari kwam het grootste deel van de abonneerkliks bij de topartikelen uit Email/nieuwsbrief. In
          juni speelde Organic Search een grotere rol.
        </p>
      </DuidingCard>
      <div className="grid gap-4 md:grid-cols-2">
        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Januari 2024</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-800">
            Topartikel:{" "}
            <span className="italic">
              Voor Houthi’s is oorlog een &apos;way of life&apos;
            </span>{" "}
            met <strong className="font-semibold">22</strong> abonneerkliks. Bij de top-25 kwam{" "}
            <strong className="font-semibold">69,85%</strong> van de abonneerkliks uit Email en{" "}
            <strong className="font-semibold">14,71%</strong> uit Organic Search.
          </p>
        </aside>
        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Juni 2024</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-800">
            Bij de top-25 kwam <strong className="font-semibold">57,14%</strong> van de abonneerkliks uit Email en{" "}
            <strong className="font-semibold">35,71%</strong> uit Organic Search. Juni is daardoor interessanter
            voor SEO-verdieping dan januari.
          </p>
        </aside>
      </div>
      <aside className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-sm leading-relaxed text-emerald-950 ring-1 ring-emerald-100">
        <p className="font-medium text-emerald-900">Conclusie</p>
        <p className="mt-2">
          Voor SEO is vooral <strong className="font-semibold">juni 2024</strong> relevant om te onderzoeken welke
          zoekgedreven artikelen goed converteerden.
        </p>
      </aside>
    </div>
  );
}

export function DuidingNieuwsbrief() {
  return (
    <DuidingCard title="Duiding nieuwsbriefblokken">
      <p>
        De nieuwsbrief-events dalen ook gecorrigeerd voor pageviews. Dat wijst erop dat het niet alleen door
        minder verkeer komt. Mobiel ligt meestal lager dan desktop, waardoor zichtbaarheid en gebruiksgemak op
        mobiel een logisch eerste aandachtspunt zijn.
      </p>
      <ul>
        <li>
          De nieuwsbrief-performance per pageview is <strong className="font-semibold">duidelijk verslechterd</strong>{" "}
          vanaf 2025.
        </li>
        <li>Mobiel presteert doorgaans lager dan desktop.</li>
        <li>
          Zonder aparte view- en click-events weten we nog niet of het probleem zit in zichtbaarheid, klik
          of formulierconversie.
        </li>
      </ul>
    </DuidingCard>
  );
}

export function VervolgstappenBlok() {
  const stappen = [
    "Meet nieuwsbriefblok_view en nieuwsbriefblok_click apart, naast inschrijving.",
    "Controleer mobiele zichtbaarheid en positie van nieuwsbriefblokken in artikelen.",
    "Analyseer shopconversie ná paywall_abonneren, zodat klik naar shop gekoppeld wordt aan daadwerkelijke abonnementen.",
    "Onderzoek juni 2024 op SEO-niveau: zoekwoorden, landingspagina’s en artikeltypen die relatief veel abonneerkliks opleverden.",
    "Vergelijk nieuwe artikelen met bestaande evergreen-artikelen op paywallviews en abonneerkliks.",
  ];

  return (
    <section
      id="vervolgstappen"
      className="mb-20 scroll-mt-32 rounded-2xl border border-violet-200 bg-violet-50/50 p-6 shadow-sm ring-1 ring-violet-100 md:p-8"
      aria-labelledby="vervolgstappen-heading"
    >
      <h2 id="vervolgstappen-heading" className="text-xl font-semibold text-violet-950 md:text-2xl">
        Aanbevolen vervolgstappen
      </h2>
      <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-violet-950/95 marker:font-semibold marker:text-violet-700">
        {stappen.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </section>
  );
}
