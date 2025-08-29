import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('bg-red-500', 'text-white')
      expect(result).toBe('bg-red-500 text-white')
    })

    it('should handle conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
      expect(result).toBe('base-class conditional-class')
    })

    it('should merge tailwind classes correctly', () => {
      const result = cn('p-4 p-2') // p-2 should override p-4
      expect(result).toBe('p-2')
    })

    it('should handle empty inputs', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle undefined and null values', () => {
      const result = cn('base', undefined, null, 'end')
      expect(result).toBe('base end')
    })
  })
})