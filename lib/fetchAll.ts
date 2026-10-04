const PAGE_SIZE = 1000

export async function fetchAll(buildQuery: () => any): Promise<any[]> {
  const rows: any[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    rows.push(...(data || []))

    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}
