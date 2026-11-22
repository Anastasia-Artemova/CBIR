import type { SimilarCase } from '../../api/pipeline'

type Props = { results: SimilarCase[] }

export function ResultsList({ results }: Props) {
  return (
    <table className="results__table">
      <thead>
        <tr>
          <th>#</th>
          <th>Subject</th>
          <th>Project</th>
          <th>Experiment</th>
          <th>Scan</th>
          <th>Distance</th>
        </tr>
      </thead>
      <tbody>
        {results.map((item, index) => (
          <tr key={item.radiomics_id}>
            <td>{index + 1}</td>
            <td>{item.xnat_subject_id}</td>
            <td>{item.xnat_project_id}</td>
            <td>{item.xnat_experiment_id}</td>
            <td>{item.xnat_scan_id}</td>
            <td>{Number(item.distance).toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
