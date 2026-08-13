import type { Role } from '../domain/types'
import { ROLE_LABELS } from '../domain/roleLabels'

interface RolePickerProps {
  value: Role | null
  onChange: (role: Role) => void
  disabled?: boolean
}

const ROLES = (['rabbit', 'dog'] as const).map((role) => ({
  role,
  ...ROLE_LABELS[role],
}))

export function RolePicker({ value, onChange, disabled = false }: RolePickerProps) {
  return (
    <fieldset className="role-picker" disabled={disabled}>
      <legend>选择你的旅行角色</legend>
      <div>
        {ROLES.map(({ role, emoji, name, note }) => (
          <button
            key={role}
            type="button"
            className={`role-card role-card--${role}`}
            aria-pressed={value === role}
            onClick={() => onChange(role)}
          >
            <span className="role-card__emoji" aria-hidden="true">{emoji}</span>
            <strong>{name}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
