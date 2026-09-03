'use client'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {

  if (!open) return null

  return (

    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >

      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[24px] shadow-2xl border border-zinc-200 w-full max-w-md p-6"
      >

        <div className="flex items-start gap-3">

          <div
            className={
              danger
                ? 'w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0'
                : 'w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0'
            }
          >

            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5"
            >

              <path d="M12 9v4" strokeLinecap="round" />
              <path d="M12 17h.01" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" />

            </svg>

          </div>

          <div className="flex-1">

            <h3 className="font-bold text-lg text-zinc-900">

              {title}

            </h3>

            <p className="text-sm text-zinc-500 mt-1.5 whitespace-pre-line">

              {message}

            </p>

          </div>

        </div>

        <div className="flex justify-end gap-3 mt-6">

          <button
            onClick={onCancel}
            className="bg-white border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50"
          >

            {cancelLabel}

          </button>

          <button
            onClick={onConfirm}
            className={
              danger
                ? 'bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700'
                : 'bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-800'
            }
          >

            {confirmLabel}

          </button>

        </div>

      </div>

    </div>

  )

}
