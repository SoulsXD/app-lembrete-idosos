import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('medalo_v4.db');

export interface Medicamento {
  id: number;
  nome: string;
  dosagem: string;
}

export const iniciarBanco = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS medicamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      dosagem TEXT NOT NULL
    );
  `);
};

export const adicionarMedicamento = (nome: string, dosagem: string) => {
  const statement = db.prepareSync('INSERT INTO medicamentos (nome, dosagem) VALUES (?, ?)');
  const result = statement.executeSync([nome, dosagem]);
  return result.lastInsertRowId;
};

export const listarMedicamentos = (): Medicamento[] => {
  return db.getAllSync('SELECT * FROM medicamentos') as Medicamento[];
};

export const deletarMedicamento = (id: number) => {
  const statement = db.prepareSync('DELETE FROM medicamentos WHERE id = ?');
  statement.executeSync([id]);
};