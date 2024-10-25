CREATE TABLE IF NOT EXISTS labels (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	src TEXT NOT NULL,
	uri TEXT NOT NULL,
	cid TEXT,
	val TEXT NOT NULL,
	neg BOOLEAN DEFAULT FALSE,
	cts DATETIME NOT NULL,
	exp DATETIME,
	sig BLOB
);

CREATE INDEX IF NOT EXISTS
	idx_labels_uri
	on labels(uri);

CREATE TABLE IF NOT EXISTS label_definitions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	identifier TEXT UNIQUE,
	en_locale_name TEXT,
	en_locale_desc TEXT
);

CREATE INDEX IF NOT EXISTS
	idx_label_definitions_identifier
	on label_definitions(identifier);
