
import React, { useState, useEffect } from 'react';
import { FuelEntry } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface FuelCalculatorProps {
  operations: string[];
  onSave: (entry: FuelEntry) => void;
}

const FuelCalculator: React.FC<FuelCalculatorProps> = ({ operations, onSave }) => {
  const [formData, setFormData] = useState<Partial<FuelEntry>>({
    date: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    carType: 'Proprio',
    roadType: 'Cidade',
    distanceKm: 0,
    operation: operations[0] || '',
    fuelType: 'Gasolina',
    pricePerLiter: 0,
    consumption: 10, // Default assumption
    totalValue: 0,
  });

  // Auto-calculate total value
  useEffect(() => {
    const { distanceKm, pricePerLiter, consumption } = formData;
    if (distanceKm && pricePerLiter && consumption && consumption > 0) {
      const calculated = (distanceKm / consumption) * pricePerLiter;
      setFormData(prev => ({ ...prev, totalValue: parseFloat(calculated.toFixed(2)) }));
    }
  }, [formData.distanceKm, formData.pricePerLiter, formData.consumption]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.totalValue || !formData.origin || !formData.destination) return;

    const newEntry: FuelEntry = {
      id: generateId(),
      type: 'fuel',
      date: formData.date!,
      origin: formData.origin!,
      destination: formData.destination!,
      carType: formData.carType!,
      roadType: formData.roadType!,
      distanceKm: Number(formData.distanceKm),
      operation: formData.operation || 'Geral',
      fuelType: formData.fuelType!,
      pricePerLiter: Number(formData.pricePerLiter),
      consumption: Number(formData.consumption),
      totalValue: Number(formData.totalValue),
    };

    onSave(newEntry);
    alert("Despesa de combustível salva!");
    // Reset minimal fields
    setFormData(prev => ({
        ...prev,
        origin: '',
        destination: '',
        distanceKm: 0,
        totalValue: 0
    }));
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm transition-colors">
      <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
        <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        Calculadora de Combustível
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Data</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Operação</label>
                <select required value={formData.operation} onChange={e => setFormData({...formData, operation: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white">
                    <option value="">Selecione</option>
                    {operations.length === 0 && <option value="Geral">Geral</option>}
                    {operations.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Origem</label>
                <input type="text" required value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Destino</label>
                <input type="text" required value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded focus:ring-1 focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white" />
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Tipo Carro</label>
                <select value={formData.carType} onChange={e => setFormData({...formData, carType: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-white">
                    <option value="Proprio">Próprio</option>
                    <option value="Alugado">Alugado</option>
                </select>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Tipo Via</label>
                <select value={formData.roadType} onChange={e => setFormData({...formData, roadType: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-white">
                    <option value="Cidade">Cidade</option>
                    <option value="Estrada">Estrada</option>
                </select>
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Combustível</label>
                <select value={formData.fuelType} onChange={e => setFormData({...formData, fuelType: e.target.value as any})} className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-800 dark:text-white">
                    <option value="Gasolina">Gasolina</option>
                    <option value="Alcool">Álcool</option>
                    <option value="Diesel">Diesel</option>
                </select>
            </div>
        </div>

        <div className="bg-orange-50 dark:bg-gray-800 p-4 rounded-lg border border-orange-100 dark:border-orange-900/30">
            <h3 className="text-orange-800 dark:text-orange-400 font-semibold text-sm mb-3">Dados de Consumo</h3>
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Distância (Km)</label>
                    <input type="number" step="0.1" required value={formData.distanceKm} onChange={e => setFormData({...formData, distanceKm: parseFloat(e.target.value)})} className="w-full p-2 border border-orange-200 dark:border-gray-600 rounded text-center font-mono bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Preço/L (R$)</label>
                    <input type="number" step="0.01" required value={formData.pricePerLiter} onChange={e => setFormData({...formData, pricePerLiter: parseFloat(e.target.value)})} className="w-full p-2 border border-orange-200 dark:border-gray-600 rounded text-center font-mono bg-white dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Consumo (Km/L)</label>
                    <input type="number" step="0.1" required value={formData.consumption} onChange={e => setFormData({...formData, consumption: parseFloat(e.target.value)})} className="w-full p-2 border border-orange-200 dark:border-gray-600 rounded text-center font-mono bg-white dark:bg-gray-700 dark:text-white" />
                </div>
            </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
             <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">Valor Total:</span>
             <span className="text-3xl font-bold text-orange-600">R$ {formData.totalValue?.toFixed(2)}</span>
        </div>

        <button type="submit" className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-lg transition-transform transform active:scale-95 mt-4">
            Registrar Combustível
        </button>
      </form>
    </div>
  );
};

export default FuelCalculator;
