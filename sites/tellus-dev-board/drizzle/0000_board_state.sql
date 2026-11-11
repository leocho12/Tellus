CREATE TABLE board_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL,
  content TEXT NOT NULL
);
