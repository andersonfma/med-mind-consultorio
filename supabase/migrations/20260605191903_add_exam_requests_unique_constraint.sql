CREATE UNIQUE INDEX exam_requests_consultation_exam_uniq
  ON exam_requests(consultation_id, exam_name);
