import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('medalo_v8.db');

export interface Medicamento {
  id: number;
  nome: string;
  dosagem: string;
  horario: string;
}

//inicialização das tabelas
export const iniciarBanco = () => {
  //tabela dos remedios (voltou ao normal, sem o nome do paciente repetido)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS medicamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      dosagem TEXT NOT NULL,
      horario TEXT NOT NULL
    );
  `);
  
  //tabela nova: guarda apenas o nome do paciente
  db.execSync(`
    CREATE TABLE IF NOT EXISTS perfil (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nome_paciente TEXT
    );
  `);
  db.execSync(`INSERT OR IGNORE INTO perfil (id, nome_paciente) VALUES (1, 'Paciente');`);
};

//crud do perfil
export const salvarNomePaciente = (nome: string) => {
  const statement = db.prepareSync('UPDATE perfil SET nome_paciente = ? WHERE id = 1');
  statement.executeSync([nome]);
};

export const obterNomePaciente = (): string => {
  const result = db.getFirstSync<{ nome_paciente: string }>('SELECT nome_paciente FROM perfil WHERE id = 1');
  return result ? result.nome_paciente : 'Paciente';
};

//crud dos medicamentos
export const adicionarMedicamento = (nome: string, dosagem: string, horario: string) => {
  const statement = db.prepareSync('INSERT INTO medicamentos (nome, dosagem, horario) VALUES (?, ?, ?)');
  const result = statement.executeSync([nome, dosagem, horario]);
  return result.lastInsertRowId;
};

export const listarMedicamentos = (): Medicamento[] => {
  return db.getAllSync('SELECT * FROM medicamentos') as Medicamento[];
};

export const deletarMedicamento = (id: number) => {
  const statement = db.prepareSync('DELETE FROM medicamentos WHERE id = ?');
  statement.executeSync([id]);
};