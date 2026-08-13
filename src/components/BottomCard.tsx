import { computeStats } from '../domain/stats'
import type { Place, Visitor } from '../domain/types'

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
}

export function BottomCard({
  places,
  filter,
  onFilterChange,
}: BottomCardProps) {
  const stats = computeStats(places)

  return (
    <section className="bottom-card" aria-label="旅行足迹统计与筛选">
      <div className="bottom-card__handle" aria-hidden="true" />
      <div className="bottom-card__heading">
        <div>
          <p className="bottom-card__eyebrow">OUR LITTLE WORLD</p>
          <h1>一起走过的地方</h1>
        </div>
        <span className="bottom-card__heart" aria-hidden="true">♥</span>
      </div>

      <div className="travel-stats" aria-label="旅行统计">
        <span><strong>{stats.countryCount}</strong> 个国家</span>
        <span><strong>{stats.cityCount}</strong> 座城市</span>
        <span><strong>{stats.togetherCount}</strong> 次一起</span>
      </div>

      {places.length === 0 && (
        <p className="bottom-card__empty">
          还没有足迹。搜索或长按地图，点亮你们的第一个地方。
        </p>
      )}

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
    </section>
  )
}
