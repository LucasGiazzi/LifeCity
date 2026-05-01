-- Tabela de reclamações
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    occurrence_date DATE NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    type VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para melhorar performance nas buscas por localização
CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints(latitude, longitude);

-- Índice para buscas por data
CREATE INDEX IF NOT EXISTS idx_complaints_date ON complaints(occurrence_date);

