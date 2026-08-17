import { useTranslation } from 'react-i18next'
import { useMemoryStore } from '@/features/memory/memoryStore'

const StudentProfile = () => {
  const { t } = useTranslation()
  const profile = useMemoryStore((s) => s.profile)
  const facts = useMemoryStore((s) => s.facts)
  const setProfile = useMemoryStore((s) => s.setProfile)

  const field = (
    key:
      | 'display_name'
      | 'preferred_name'
      | 'address_form'
      | 'grade_level'
      | 'current_topic'
      | 'progress_notes',
    label: string
  ) => (
    <div className="mb-16">
      <div className="mb-8 font-bold">{label}</div>
      <input
        className="text-ellipsis px-16 py-8 w-full bg-white hover:bg-white-hover rounded-8"
        type="text"
        value={profile?.[key] ?? ''}
        onChange={(e) => setProfile({ [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="mt-16">
      <div className="mb-16 typography-20 font-bold">
        {t('StudentProfile.Title')}
      </div>
      {field('display_name', t('StudentProfile.DisplayName'))}
      {field('preferred_name', t('StudentProfile.PreferredName'))}
      {field('address_form', t('StudentProfile.AddressForm'))}
      {field('grade_level', t('StudentProfile.GradeLevel'))}
      {field('current_topic', t('StudentProfile.CurrentTopic'))}
      {field('progress_notes', t('StudentProfile.ProgressNotes'))}

      <div className="mb-16">
        <div className="mb-8 font-bold">{t('StudentProfile.Interests')}</div>
        <input
          className="text-ellipsis px-16 py-8 w-full bg-white hover:bg-white-hover rounded-8"
          type="text"
          value={(profile?.interests ?? []).join(', ')}
          onChange={(e) =>
            setProfile({
              interests: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      <div className="mb-16">
        <div className="mb-8 font-bold">{t('StudentProfile.Facts')}</div>
        <ul className="list-disc ml-16">
          {facts.map((f, i) => (
            <li key={i}>
              [{f.category}] {f.key}: {f.value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
export default StudentProfile
