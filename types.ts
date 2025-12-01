export enum ExpenseCategory {
  TransporteApp = "Ônibus/ Uber",
  Pedagio = "Pedágio",
  Estacionamento = "Estacionamento",
  Supermercado = "Supermercado",
  MaterialEscritorio = "Material Escritório",
  Copiadora = "Copiadora",
  Hospedagem = "Hospedagem",
  Lavanderia = "Lavanderia/ Faxina",
  Utilidades = "Contas Luz/Gás/Água",
  ManutencaoGeral = "Manutenção",
  Carro = "Carro",
  Correio = "Correio",
  Refeicao = "Refeição",
  Taxas = "Taxas",
  ManutencaoEscritorio = "Manutenção Escritório",
  Outros = "Outros"
}

export interface Expense {
  id: string;
  date: string;
  city: string;
  amount: number;
  category: ExpenseCategory | string;
  operation: string;
  notes: string;
  receiptImage?: string; // Base64
  type: 'receipt';
}

export interface FuelEntry {
  id: string;
  date: string;
  origin: string;
  destination: string;
  carType: 'Proprio' | 'Alugado';
  roadType: 'Cidade' | 'Estrada';
  distanceKm: number;
  operation: string;
  fuelType: 'Alcool' | 'Gasolina' | 'Diesel';
  pricePerLiter: number;
  consumption: number; // km/l
  totalValue: number;
  type: 'fuel';
}

export type Transaction = Expense | FuelEntry;

export interface AppState {
  transactions: Transaction[];
  operations: string[];
}