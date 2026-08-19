/**
 * Recording stand-in for the Supabase browser client.
 *
 * Records the full query builder chain so tests can assert the table, filters,
 * ordering and limit that the service actually issues, without any network.
 */

export const supabaseCalls = {
  inserts: [],
  selects: [],
  deletes: [],
  // Recorded so tests can prove no update/edit path exists.
  updates: [],
  reset() {
    this.inserts.length = 0
    this.selects.length = 0
    this.deletes.length = 0
    this.updates.length = 0
  },
}

// Set by a test to make the next insert/select fail.
export const supabaseFailure = { insert: null, select: null, delete: null }

export const supabaseData = { rows: [] }

function selectBuilder(table) {
  const record = { table, columns: null, filters: {}, order: null, limit: null }
  supabaseCalls.selects.push(record)

  const builder = {
    select(columns) {
      record.columns = columns
      return builder
    },
    eq(column, value) {
      record.filters[column] = value
      return builder
    },
    order(column, options) {
      record.order = { column, ...options }
      return builder
    },
    limit(value) {
      record.limit = value
      return builder
    },
    // Supabase's real query builder is thenable — that is exactly how
    // `await supabase.from(...).select(...)` resolves — so the stub must be too.
    // eslint-disable-next-line unicorn/no-thenable
    then(resolve, reject) {
      const outcome = supabaseFailure.select
        ? { data: null, error: supabaseFailure.select }
        : { data: supabaseData.rows, error: null }
      return Promise.resolve(outcome).then(resolve, reject)
    },
  }
  return builder
}

function deleteBuilder(table) {
  const record = { table, filters: {} }
  supabaseCalls.deletes.push(record)

  const builder = {
    eq(column, value) {
      record.filters[column] = value
      return builder
    },
    // eslint-disable-next-line unicorn/no-thenable
    then(resolve, reject) {
      const outcome = supabaseFailure.delete
        ? { data: null, error: supabaseFailure.delete }
        : { data: null, error: null }
      return Promise.resolve(outcome).then(resolve, reject)
    },
  }
  return builder
}

export const supabase = {
  from(table) {
    return {
      delete() {
        return deleteBuilder(table)
      },
      update(values) {
        supabaseCalls.updates.push({ table, values })
        throw new Error('update is not permitted on screenshot_scan_history')
      },
      insert(row) {
        const record = { table, row }
        supabaseCalls.inserts.push(record)
        const result = {
          select() {
            return result
          },
          single() {
            return supabaseFailure.insert
              ? Promise.resolve({ data: null, error: supabaseFailure.insert })
              : Promise.resolve({ data: { id: 'new-row', ...row }, error: null })
          },
        }
        return result
      },
      select(columns) {
        return selectBuilder(table).select(columns)
      },
    }
  },
}
