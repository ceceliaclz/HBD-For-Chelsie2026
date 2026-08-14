import { computeStats } from '../domain/stats'
import type { Place, Visitor } from '../domain/types'
import { IconPlus } from './icons'

type PlaceFilter = Visitor | 'all'

const FILTERS: Array<{ value: PlaceFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'rabbit', label: '兔子' },
  { value: 'dog', label: '啾啾' },
  { value: 'together', label: '一起' },
]

export interface BottomCardProps {
  places: Place[]
  filter: PlaceFilter
  onFilterChange: (filter: PlaceFilter) => void
  onAddPlace: () => void
}

export function BottomCard({
  places,
  filter,
  onFilterChange,
  onAddPlace,
}: BottomCardProps) {
  return (
    <section className="home-dock" aria-label="筛选与点亮">
      <div className="filter-chips" aria-label="按旅行成员筛选">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`filter-chip filter-chip--${item.value}`}
            aria-pressed={filter === item.value}
            onClick={() => onFilterChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {places.length === 0 && (
        <p className="home-dock__empty">
          搜索或长按地图，点亮你们的第一个地方。
        </p>
      )}

      <button type="button" className="home-dock__cta" onClick={onAddPlace}>
        <IconPlus className="home-dock__cta-icon" />
        点亮新地方
      </button>
    </section>
  )
}

export interface HomeTopStatsProps {
  places: Place[]
}

export function HomeTopStats({ places }: HomeTopStatsProps) {
  const stats = computeStats(places)

  return (
    <header className="home-top-meta" aria-label="地图概览">
      <p className="home-top-meta__eyebrow">OUR LITTLE WORLD</p>
      <h1 className="home-top-meta__title">一起走过的地方</h1>
      <div className="home-top-meta__stats" aria-label="旅行统计">
        <span>
          <strong>{stats.countryCount}</strong> 国
        </span>
        <span>
          <strong>{stats.cityCount}</strong> 城
        </span>
        <span>
          <strong>{stats.togetherCount}</strong> 一起
        </span>
      </div>
    </header>
  )
}
