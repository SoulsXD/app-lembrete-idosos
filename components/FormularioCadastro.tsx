import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Props {
  nomePacienteGlobal: string;
  atualizarPerfilPaciente: (texto: string) => void;
  onSalvar: (nome: string, dosagem: string, intervalo: string, horarioForm: string, date: Date) => Promise<boolean>;
}

export default function FormularioCadastro({ nomePacienteGlobal, atualizarPerfilPaciente, onSalvar }: Props) {
  const [nomeForm, setNomeForm] = useState('');
  const [dosagemForm, setDosagemForm] = useState('');
  const [intervaloForm, setIntervaloForm] = useState(''); 
  const [horarioForm, setHorarioForm] = useState('Clique para selecionar');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const onChangeTime = (_: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setHorarioForm(`${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`);
    }
  };

  const dispararSalvamento = async () => {
    // Chama a função principal lá no index.tsx. Se der certo (true), ele limpa os campos.
    const sucesso = await onSalvar(nomeForm, dosagemForm, intervaloForm, horarioForm, date);
    if (sucesso) {
      setNomeForm('');
      setDosagemForm('');
      setIntervaloForm('');
      setHorarioForm('Clique para selecionar');
    }
  };

  return (
    <View style={styles.areaAba}>
      <View style={styles.cardPerfil}>
        <Text style={styles.tituloSecao}>quem vai tomar os remedios?</Text>
        <TextInput style={styles.inputPerfil} placeholder="ex: dona maria" placeholderTextColor="#888" value={nomePacienteGlobal} onChangeText={atualizarPerfilPaciente} />
      </View>

      <View style={styles.cardCadastro}>
        <Text style={styles.tituloSecao}>cadastrar remedio</Text>
        <TextInput style={styles.input} placeholder="nome do remedio" placeholderTextColor="#888" value={nomeForm} onChangeText={setNomeForm} />
        <TextInput style={styles.input} placeholder="dosagem (ex: 50mg)" placeholderTextColor="#888" value={dosagemForm} onChangeText={setDosagemForm} />
        <TextInput style={styles.input} placeholder="repetir a cada quantas horas? (opcional)" placeholderTextColor="#888" value={intervaloForm} onChangeText={setIntervaloForm} keyboardType="numeric" />
        
        <TouchableOpacity style={styles.botaoHorario} onPress={() => setShowPicker(true)}>
          <Text style={styles.textoBotaoHorario}>horario: {horarioForm}</Text>
        </TouchableOpacity>
        {showPicker && <DateTimePicker value={date} mode="time" is24Hour={true} display="default" onChange={onChangeTime} />}

        <TouchableOpacity style={styles.botaoSalvar} onPress={dispararSalvamento}>
          <Text style={styles.textoBotaoSalvar}>salvar na lista</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  areaAba: { flex: 1, paddingHorizontal: 20 },
  cardPerfil: { backgroundColor: '#E5FFE9', padding: 15, borderWidth: 1, borderColor: '#91FFA2', marginBottom: 15, borderRadius: 5 },
  inputPerfil: { backgroundColor: '#FFFFFF', color: '#000000', padding: 10, borderWidth: 1, borderColor: '#91FFA2', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  cardCadastro: { backgroundColor: '#FFFFFF', padding: 15, borderWidth: 1, borderColor: '#DDDDDD', marginBottom: 20 },
  tituloSecao: { color: '#333333', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: '#FFFFFF', color: '#000000', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, fontSize: 16 },
  botaoHorario: { backgroundColor: '#FFFFFF', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, alignItems: 'center' },
  textoBotaoHorario: { color: '#333333', fontSize: 16, fontWeight: 'bold' },
  botaoSalvar: { backgroundColor: '#91FFA2', padding: 15, alignItems: 'center', marginTop: 5 }, 
  textoBotaoSalvar: { color: '#000000', fontWeight: 'bold', fontSize: 16 }
});