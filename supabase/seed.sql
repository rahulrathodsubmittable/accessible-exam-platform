-- Insert Sample Candidates (No password authentication; Candidate ID is the key)
INSERT INTO candidates (id, candidate_id, full_name, email) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'EXM-2026-A7K92', 'Aarav Sharma', 'aarav@example.com'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'EXM-2026-B4P81', 'Priya Patel', 'priya@example.com'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'EXM-2026-K9X32', 'Rohan Verma', 'rohan@example.com');

-- Insert Formal Scheduled Exam
INSERT INTO exams (
  id, title, subject, description, mode, duration_minutes, 
  scheduled_start, scheduled_end, is_active, max_explanations_per_q, 
  max_reset_explanations_per_q, allow_ai_explanations
) VALUES (
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e00',
  'Data Structures & Algorithms Formal Assessment',
  'Computer Science',
  'Formal assessment covering linked lists, trees, and time complexity.',
  'exam',
  60,
  NOW() - INTERVAL '30 minutes',
  NOW() + INTERVAL '12 hours',
  TRUE,
  3,
  2,
  TRUE
);

-- Assign Exam to Candidate EXM-2026-A7K92
INSERT INTO candidate_exams (candidate_id, exam_id, is_completed) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e00', FALSE);

-- Insert Questions
INSERT INTO questions (
  id, exam_id, question_text, question_type, difficulty, subject, topic, 
  visual_content_url, visual_description, explanation_text, marks, order_index
) VALUES 
(
  'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q01',
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e00',
  'What is the average time complexity for searching an element in a balanced Binary Search Tree (BST)?',
  'mcq', 'medium', 'Computer Science', 'Binary Search Trees',
  NULL,
  'Diagram showing a binary search tree root with two subtrees divided symmetrically.',
  'In a balanced BST, each comparison reduces the search space by half, resulting in a logarithmic time complexity of O(log n).',
  1, 1
),
(
  'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q02',
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e00',
  'Which data structure follows the First-In, First-Out (FIFO) principle?',
  'mcq', 'easy', 'Computer Science', 'Linear Data Structures',
  NULL,
  'Diagram showing items entering at the rear and leaving from the front of a queue container.',
  'A Queue strictly operates on FIFO principles, where elements are enqueued at the back and dequeued from the front.',
  1, 2
);

-- Insert Options for Question 1
INSERT INTO options (id, question_id, option_key, option_text, is_correct) VALUES
('o1-1', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q01', 'A', 'O(1)', FALSE),
('o1-2', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q01', 'B', 'O(n)', FALSE),
('o1-3', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q01', 'C', 'O(log n)', TRUE),
('o1-4', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q01', 'D', 'O(n^2)', FALSE);

-- Insert Options for Question 2
INSERT INTO options (id, question_id, option_key, option_text, is_correct) VALUES
('o2-1', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q02', 'A', 'Stack', FALSE),
('o2-2', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q02', 'B', 'Queue', TRUE),
('o2-3', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q02', 'C', 'Array', FALSE),
('o2-4', 'q0eebc99-9c0b-4ef8-bb6d-6bb9bd380q02', 'D', 'Tree', FALSE);