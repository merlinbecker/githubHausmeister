import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loadStateFromFile, saveStateToFile, resetMonthlyCounterIfNeeded, type AppStateFile } from '../../../server/lib/state'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn().mockReturnValue(undefined)
  }
}))

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn().mockReturnValue('/mocked/data/state.json'),
    dirname: vi.fn().mockReturnValue('/mocked/data')
  }
}))

describe('State Management', () => {
  const mockFs = vi.mocked(fs)
  const mockPath = vi.mocked(path)

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadStateFromFile', () => {
    it('should return default state when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false)
      mockFs.writeFileSync.mockImplementation(() => {})
      mockFs.mkdirSync.mockReturnValue(undefined)

      const result = loadStateFromFile()

      expect(result).toEqual({
        monthlyDone: 0,
        lastReset: expect.any(String),
        systemRunning: true
      })
      expect(mockFs.existsSync).toHaveBeenCalled()
    })

    it('should parse and return state from existing file', () => {
      const mockState: AppStateFile = {
        monthlyDone: 5,
        lastReset: '2024-01-01T00:00:00.000Z',
        systemRunning: false
      }

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockState))

      const result = loadStateFromFile()

      expect(result).toEqual(mockState)
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/mocked/data/state.json', 'utf8')
    })

    it('should return default state when file parsing fails', () => {
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('invalid json')

      const result = loadStateFromFile()

      expect(result).toEqual({
        monthlyDone: 0,
        lastReset: expect.any(String),
        systemRunning: true
      })
      expect(console.error).toHaveBeenCalledWith('Error loading state file:', expect.any(Error))
    })
  })

  describe('saveStateToFile', () => {
    it('should save state to file and create directory if needed', () => {
      const state: AppStateFile = {
        monthlyDone: 10,
        lastReset: '2024-02-01T00:00:00.000Z',
        systemRunning: true
      }

      mockFs.existsSync.mockReturnValue(false)
      mockFs.mkdirSync.mockReturnValue(undefined)
      mockFs.writeFileSync.mockImplementation(() => {})

      saveStateToFile(state)

      expect(mockPath.dirname).toHaveBeenCalledWith('/mocked/data/state.json')
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockPath.dirname.mock.results[0].value, { recursive: true })
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/mocked/data/state.json',
        JSON.stringify(state, null, 2)
      )
    })

    it('should handle save errors gracefully', () => {
      const state: AppStateFile = {
        monthlyDone: 10,
        lastReset: '2024-02-01T00:00:00.000Z',
        systemRunning: true
      }

      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed')
      })

      saveStateToFile(state)

      expect(console.error).toHaveBeenCalledWith('Error saving state file:', expect.any(Error))
    })
  })

  describe('resetMonthlyCounterIfNeeded', () => {
    it('should reset counter when it is a new month', () => {
      const oldState: AppStateFile = {
        monthlyDone: 25,
        lastReset: '2024-01-15T00:00:00.000Z',
        systemRunning: true
      }

      // Mock the current date to be in February
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-02-15T10:00:00.000Z'))

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify(oldState))
      mockFs.writeFileSync.mockImplementation(() => {})
      mockFs.mkdirSync.mockReturnValue(undefined)

      const result = resetMonthlyCounterIfNeeded()

      expect(result.monthlyDone).toBe(0)
      expect(result.lastReset).toBe('2024-02-15T10:00:00.000Z')
      expect(result.systemRunning).toBe(true)

      vi.useRealTimers()
    })

    it('should not reset counter when it is the same month', () => {
      const currentState: AppStateFile = {
        monthlyDone: 25,
        lastReset: '2024-02-01T00:00:00.000Z',
        systemRunning: true
      }

      // Mock the current date to be in the same month
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-02-15T10:00:00.000Z'))

      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify(currentState))

      const result = resetMonthlyCounterIfNeeded()

      expect(result).toEqual(currentState)

      vi.useRealTimers()
    })
  })
})