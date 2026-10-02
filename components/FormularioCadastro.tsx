import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

interface Props {
  nomePacienteGlobal: string;
  atualizarPerfilPaciente: (texto: string) => void;
  onSalvar: (nome: string, dosagem: string, intervalo: string, horarioForm: string, date: Date) => Promise<boolean>;
}

export default function FormularioCadastro({ nomePacienteGlobal, atualizarPerfilPaciente, onSalvar }: Props) {
  const [nomeForm, setNomeForm] = useState('');
  const [dosagemForm, setDosagemForm] = useState('');
  const [intervaloForm, setIntervaloForm] = useState('0'); 
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
    const intervaloTratado = intervaloForm === '0' ? '' : intervaloForm;
    const sucesso = await onSalvar(nomeForm, dosagemForm, intervaloTratado, horarioForm, date);
    if (sucesso) {
      setNomeForm('');
      setDosagemForm('');
      setIntervaloForm('0');
      setHorarioForm('Clique para selecionar');
    }
  };

  return (
    <View style={styles.areaAba}>
      
      <View style={styles.cardPerfil}>
        <Text style={styles.tituloSecao}>Nome do paciente</Text>
        <TextInput 
          style={styles.inputPerfil} 
          placeholder="Ex: Dona Maria" 
          placeholderTextColor="#888" 
          value={nomePacienteGlobal} 
          onChangeText={atualizarPerfilPaciente} 
        />
      </View>

      <View style={styles.cardCadastro}>
        <Text style={styles.tituloSecao}>Cadastrar medicamento</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder="Nome do medicamento" 
          placeholderTextColor="#888" 
          value={nomeForm} 
          onChangeText={setNomeForm} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Dosagem (ex: 1 comprimido, 20 gotas)" 
          placeholderTextColor="#888" 
          value={dosagemForm} 
          onChangeText={setDosagemForm} 
        />
        
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={intervaloForm}
            onValueChange={(itemValue) => setIntervaloForm(itemValue)}
            style={{ color: '#000000' }}
            dropdownIconColor="#000000"
          >
            <Picker.Item label="Apenas uma vez" value="0" />
            <Picker.Item label="A cada 4 horas" value="4" />
            <Picker.Item label="A cada 6 horas" value="6" />
            <Picker.Item label="A cada 8 horas" value="8" />
            <Picker.Item label="A cada 12 horas" value="12" />
            <Picker.Item label="A cada 24 horas" value="24" />
          </Picker>
        </View>
        
        <TouchableOpacity style={styles.botaoHorario} onPress={() => setShowPicker(true)}>
          <Text style={styles.textoBotaoHorario}>Horário: {horarioForm}</Text>
        </TouchableOpacity>
        {showPicker && <DateTimePicker value={date} mode="time" is24Hour={true} display="default" onChange={onChangeTime} />}

        <TouchableOpacity style={styles.botaoSalvar} onPress={dispararSalvamento}>
          <Text style={styles.textoBotaoSalvar}>Salvar agendamento</Text>
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
  pickerContainer: { borderWidth: 1, borderColor: '#CCCCCC', backgroundColor: '#FFFFFF', marginBottom: 10, justifyContent: 'center' },
  botaoHorario: { backgroundColor: '#FFFFFF', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, alignItems: 'center' },
  textoBotaoHorario: { color: '#333333', fontSize: 16, fontWeight: 'bold' },
  botaoSalvar: { backgroundColor: '#91FFA2', padding: 15, alignItems: 'center', marginTop: 5, borderRadius: 5 }, 
  textoBotaoSalvar: { color: '#000000', fontWeight: 'bold', fontSize: 16 }
});