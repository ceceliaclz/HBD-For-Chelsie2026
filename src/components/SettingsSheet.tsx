import { useState } from 'react'
import type { CoupleBook, MarkerPack, Member } from '../domain/types'
import { saveBook } from '../storage/localDb'
import { getSupabase } from '../sync/supabaseClient'
import { updateBookRemote } from '../sync/syncEngine'

interface SettingsSheetProps {
  open: boolean
  book: CoupleBook
  member: Member
  onClose: () => void
  onBookChange: (book: CoupleBook) => void
}

const PACKS: Array<{ value: MarkerPack; label: string; glyphs: string }> = [
  { value: 'stars', label: '星光', glyphs: '⭐ 🌟 💖' },
  { value: 'stamps', label: '邮戳', glyphs: '🎫 📮 💌' },
  { value: 'animals', label: '动物', glyphs: '🐰 🐕 💕' },
]

export function SettingsSheet({
  open,
  book,
  member,
  onClose,
  onBookChange,
}: SettingsSheetProps) {
  const [message, setMessage] = useState('')
  if (!open) return null

  const shareUrl = `${window.location.origin}/join/${book.inviteCode}`
  const cloudConfigured = getSupabase() !== null

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setMessage('邀请链接已复制')
    } catch {
      setMessage('复制失败，请手动复制邀请码')
    }
  }

  const updatePack = async (markerPack: MarkerPack) => {
    const nextBook = { ...book, markerPack }
    await saveBook(nextBook)
    onBookChange(nextBook)
    try {
      const synced = await updateBookRemote(nextBook)
      setMessage(synced ? '标记样式已同步' : '已保存到本机 · 未配置云同步')
    } catch {
      setMessage('已保存到本机，云同步稍后重试')
    }
  }

  return (
    <div className="add-place-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="add-place-sheet__handle" />
        <header className="add-place-sheet__header">
          <div>
            <p>OUR LITTLE ATLAS</p>
            <h2 id="settings-title">地图设置</h2>
          </div>
          <button type="button" className="sheet-close" aria-label="关闭" onClick={onClose}>×</button>
        </header>

        <div className="settings-section">
          <span className="settings-label">你的角色</span>
          <strong>{member.role === 'rabbit' ? '🐰 兔子' : '🐕 线条小狗'}</strong>
        </div>

        <div className="settings-section">
          <span className="settings-label">邀请另一半</span>
          <div className="invite-code-row">
            <code>{book.inviteCode}</code>
            <button
              type="button"
              disabled={!cloudConfigured}
              onClick={() => void copyInvite()}
            >
              复制邀请链接
            </button>
          </div>
          <small>
            {cloudConfigured ? shareUrl : '未配置云同步，邀请功能暂不可用'}
          </small>
        </div>

        <fieldset className="pack-picker">
          <legend>地图标记样式</legend>
          {PACKS.map((pack) => (
            <button
              key={pack.value}
              type="button"
              aria-pressed={book.markerPack === pack.value}
              onClick={() => void updatePack(pack.value)}
            >
              <span>{pack.glyphs}</span>
              <strong>{pack.label}</strong>
            </button>
          ))}
        </fieldset>
        {message && <p className="settings-message" role="status">{message}</p>}
      </section>
    </div>
  )
}
