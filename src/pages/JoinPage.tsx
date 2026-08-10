import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RolePicker } from '../components/RolePicker'
import { isValidInviteCode, normalizeInviteCode } from '../domain/inviteCode'
import type { Role } from '../domain/types'
import { useBookStore } from '../state/bookStore'
import { BookFullError, RoleTakenError } from '../sync/syncEngine'

function joinErrorMessage(error: unknown): string {
  if (error instanceof RoleTakenError) return '这个角色已经被对方选择了，请换一个'
  if (error instanceof BookFullError) return '这张地图已经有两位旅行成员了'
  if (error instanceof Error && error.message === 'Supabase is not configured') {
    return '未配置云同步，暂时无法加入共享地图'
  }
  if (error instanceof Error && error.message === 'Couple book not found') {
    return '没有找到这个邀请码，请和对方确认'
  }
  return '加入失败，请检查网络后重试'
}

export function JoinPage() {
  const { code: routeCode = '' } = useParams()
  const navigate = useNavigate()
  const { joinBook } = useBookStore()
  const [code, setCode] = useState(normalizeInviteCode(routeCode))
  const [role, setRole] = useState<Role | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    const normalized = normalizeInviteCode(code)
    if (!isValidInviteCode(normalized)) {
      setError('请输入正确的 6 位邀请码')
      return
    }
    if (!role) {
      setError('请先选择你的旅行角色')
      return
    }

    setJoining(true)
    setError('')
    try {
      await joinBook(normalized, role)
      navigate('/', { replace: true })
    } catch (joinError) {
      setError(joinErrorMessage(joinError))
      setJoining(false)
    }
  }

  return (
    <main className="join-page">
      <section className="join-panel">
        <Link className="back-link" to="/">← 返回</Link>
        <p className="onboarding-kicker">SAME MAP, TWO HEARTS</p>
        <h1>加入我们的地图</h1>
        <p className="join-intro">输入对方分享的暗号，再选择属于你的足迹。</p>

        <label className="invite-input">
          <span>6 位邀请码</span>
          <input
            value={code}
            maxLength={6}
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="例如 MAP7YK"
            onChange={(event) => {
              setCode(normalizeInviteCode(event.target.value))
              setError('')
            }}
          />
        </label>

        <RolePicker value={role} onChange={setRole} disabled={joining} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button
          type="button"
          className="primary-action"
          disabled={joining}
          onClick={() => void handleJoin()}
        >
          {joining ? '正在汇合足迹…' : '加入地图'}
        </button>
      </section>
    </main>
  )
}
