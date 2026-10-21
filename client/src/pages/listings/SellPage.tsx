import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { isListingCategory, LISTING_CATEGORIES, LISTING_LIMITS } from '@campus/shared'
import { ApiError } from '../../api/client'
import { Alert, Button, Card, Input, Select, Textarea } from '../../components'
import { Page } from '../../layout/Page'
import { CATEGORY_LABELS, formatPrice, parseDollarsToCents } from '../../listings/format'
import { createListing, uploadListingPhoto } from '../../listings/listingsApi'
import type { ListingDetailState } from './ListingDetailPage'
import './listings.css'

type PhotoDraft = { key: string; file: File; previewUrl: string }

const categoryOptions = LISTING_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))
const maxPhotoMb = LISTING_LIMITS.photoMaxBytes / (1024 * 1024)

type FieldErrors = Partial<Record<'title' | 'description' | 'category' | 'price', string>>

export function SellPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Free the preview object URLs when the page unmounts.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), [])

  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // so picking the same file again still fires onChange
    const rejected: string[] = []
    const accepted: PhotoDraft[] = []
    for (const file of files) {
      if (!(LISTING_LIMITS.photoTypes as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name} isn't a JPEG, PNG or WebP image.`)
      } else if (file.size > LISTING_LIMITS.photoMaxBytes) {
        rejected.push(`${file.name} is over ${maxPhotoMb} MB.`)
      } else if (photos.length + accepted.length >= LISTING_LIMITS.photosMax) {
        rejected.push(`You can add up to ${LISTING_LIMITS.photosMax} photos.`)
        break
      } else {
        accepted.push({ key: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })
      }
    }
    setPhotos((prev) => [...prev, ...accepted])
    setPhotoError(rejected.length ? rejected.join(' ') : null)
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.key === key)
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      return prev.filter((p) => p.key !== key)
    })
    setPhotoError(null)
  }

  function validate() {
    const errors: FieldErrors = {}
    if (!title.trim()) errors.title = 'Add a title.'
    if (!description.trim()) errors.description = 'Add a description.'
    if (!isListingCategory(category)) errors.category = 'Pick a category.'
    const priceCents = parseDollarsToCents(price)
    if (priceCents === null) {
      errors.price = 'Enter a price like 20 or 19.99.'
    } else if (priceCents < LISTING_LIMITS.priceMinCents || priceCents > LISTING_LIMITS.priceMaxCents) {
      errors.price = `Price must be between ${formatPrice(LISTING_LIMITS.priceMinCents)} and ${formatPrice(LISTING_LIMITS.priceMaxCents)}.`
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0 && priceCents !== null && isListingCategory(category)
      ? { title: title.trim(), description: description.trim(), category, priceCents }
      : null
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const input = validate()
    if (!input) return

    setProgress('Posting listing…')
    let listingId: string
    try {
      listingId = (await createListing(input)).listing.id
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      setProgress(null)
      return
    }

    // The listing exists now, so a failed photo doesn't undo it: report it on the listing page instead.
    const photoErrors: string[] = []
    for (const [i, photo] of photos.entries()) {
      setProgress(`Uploading photo ${i + 1} of ${photos.length}…`)
      try {
        await uploadListingPhoto(listingId, photo.file)
      } catch (err) {
        photoErrors.push(`${photo.file.name}: ${err instanceof ApiError ? err.message : 'upload failed'}`)
      }
    }

    const state: ListingDetailState = { posted: true, photoErrors }
    navigate(`/listings/${listingId}`, { state })
  }

  const submitting = progress !== null

  return (
    <Page title="Post a listing" description="Sell something to students at your school." width="narrow">
      <Card>
        <form className="sell-form" onSubmit={handleSubmit} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <fieldset className="sell-form__fields" disabled={submitting}>
            <Input
              label="Title"
              required
              maxLength={LISTING_LIMITS.titleMax}
              placeholder="e.g. Calculus textbook, 8th edition"
              value={title}
              error={fieldErrors.title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              label="Description"
              hint="Condition, pickup spot on campus, anything a buyer should know."
              required
              maxLength={LISTING_LIMITS.descriptionMax}
              value={description}
              error={fieldErrors.description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="sell-form__row">
              <Select
                label="Category"
                required
                placeholder="Pick a category"
                options={categoryOptions}
                value={category}
                error={fieldErrors.category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Input
                label="Price ($)"
                required
                inputMode="decimal"
                placeholder="20.00"
                value={price}
                error={fieldErrors.price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="field">
              <span className="field__label">Photos</span>
              <p className="field__hint">
                Up to {LISTING_LIMITS.photosMax} JPEG, PNG or WebP images, {maxPhotoMb} MB each. The first one is the cover.
              </p>
              {photos.length > 0 && (
                <ul className="photo-previews">
                  {photos.map((p, i) => (
                    <li key={p.key} className="photo-preview">
                      <img src={p.previewUrl} alt={`Photo ${i + 1}: ${p.file.name}`} />
                      {i === 0 && <span className="photo-preview__cover">Cover</span>}
                      <button
                        type="button"
                        className="photo-preview__remove"
                        aria-label={`Remove ${p.file.name}`}
                        onClick={() => removePhoto(p.key)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={fileInput}
                type="file"
                accept={LISTING_LIMITS.photoTypes.join(',')}
                multiple
                hidden
                onChange={addPhotos}
              />
              {photos.length < LISTING_LIMITS.photosMax && (
                <div>
                  <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                    {photos.length ? 'Add more photos' : 'Add photos'}
                  </Button>
                </div>
              )}
              {photoError && (
                <p className="field__error" role="alert">
                  {photoError}
                </p>
              )}
            </div>
          </fieldset>

          <Button type="submit" fullWidth loading={submitting}>
            {progress ?? 'Post listing'}
          </Button>
        </form>
      </Card>
    </Page>
  )
}
