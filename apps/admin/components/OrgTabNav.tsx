import Link from 'next/link'

type OrgTab = 'detail' | 'recommendations'

const TABS: { id: OrgTab; label: string; href: (id: string) => string }[] = [
  { id: 'detail',          label: 'Organization',        href: (id) => `/organizations/${id}` },
  { id: 'recommendations', label: 'Recommendation Model', href: (id) => `/organizations/${id}/recommendations` },
]

export function OrgTabNav({ orgId, active }: { orgId: string; active: OrgTab }) {
  return (
    <div className="flex gap-1 border-b" style={{ borderColor: 'var(--aura-border)' }}>
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <Link
            key={tab.id}
            href={tab.href(orgId)}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: isActive ? 'var(--aura-green)' : 'transparent',
              color: isActive ? 'var(--aura-text)' : 'var(--aura-text2)',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
