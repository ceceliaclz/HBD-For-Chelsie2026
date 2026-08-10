import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Role } from '../domain/types'
import { RolePicker } from './RolePicker'

interface OnboardingProps {
  onCreate: (role: Role) => Promise<unknown>
}

export function Onboarding({ onCreate }: OnboardingProps) {
  const navigate = useNavigate()
  const [role, setRole] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!role) return
    setCreating(true)
    setError('')
    try {
      await onCreate(role)
    } catch {
      setError('地图暂时没创建成功，请检查网络后重试')
      setCreating(false)
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-orbit" aria-hidden="true">✦</div>
      <section className="onboarding-panel">
        <p className="onboarding-kicker">COUPLE TRAVEL ATLAS</p>
        <h1>把两个人的远方，<br />画成一张地图。</h1>
        <p className="onboarding-intro">每一次出发，都在你们的世界里亮一颗星。</p>

        <div className="onboarding-actions">
          <article className="onboarding-card onboarding-card--create">
            <span aria-hidden="true">🗺️</span>
            <div>
              <h2>创建我们的地图</h2>
              <p>先选一个代表你的角色</p>
            </div>
          </article>
          <RolePicker value={role} onChange={setRole} disabled={creating} />
          <button
            type="button"
            className="primary-action"
            disabled={!role || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? '正在铺开地图…' : '开始记录旅程'}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}

          <button
            type="button"
            className="onboarding-card onboarding-card--join"
            onClick={() => navigate('/join')}
          >
            <span aria-hidden="true">💌</span>
            <div>
              <strong>加入对方</strong>
              <small>使用 6 位邀请码进入同一张地图</small>
            </div>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </section>
    </main>
  )
}
