import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

interface Props {
  nomePacienteGlobal: string;
  atualizarPerfilPaciente: (texto: string) => void;
  onSalvar: (nome: string, dosagem: string, intervalo: string, horarioForm: string, date: Date) => Promise<boolean>;
  isDarkMode: boolean;
  fecharModalSucesso: () => void;
}

export default function FormularioCadastro({ nomePacienteGlobal, atualizarPerfilPaciente, onSalvar, isDarkMode, fecharModalSucesso }: Props) {
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
      
      <View style={[styles.cardPerfil, isDarkMode && styles.cardPerfilDark]}>
        <Text style={[styles.tituloSecao, isDarkMode && styles.textoDark]}>Nome do paciente</Text>
        <TextInput 
          style={[styles.inputPerfil, isDarkMode && styles.inputDark]} 
          placeholder="Ex: Dona Maria" 
          placeholderTextColor={isDarkMode ? "#888" : "#888"} 
          value={nomePacienteGlobal} 
          onChangeText={atualizarPerfilPaciente} 
        />
      </View>

      <View style={[styles.cardCadastro, isDarkMode && styles.cardCadastroDark]}>
        <Text style={[styles.tituloSecao, isDarkMode && styles.textoDark]}>Cadastrar medicamento</Text>
        
        <TextInput style={[styles.input, isDarkMode && styles.inputDark]} placeholder="Nome do medicamento" placeholderTextColor="#888" value={nomeForm} onChangeText={setNomeForm} />
        <TextInput style={[styles.input, isDarkMode && styles.inputDark]} placeholder="Dosagem (ex: 1 comprimido, 20 gotas)" placeholderTextColor="#888" value={dosagemForm} onChangeText={setDosagemForm} />
        
        <View style={[styles.pickerContainer, isDarkMode && styles.inputDark]}>
          <Picker
            selectedValue={intervaloForm}
            onValueChange={(itemValue) => setIntervaloForm(itemValue)}
            style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}
            dropdownIconColor={isDarkMode ? '#FFFFFF' : '#000000'}
          >
            <Picker.Item label="Apenas uma vez" value="0" />
            <Picker.Item label="A cada 4 horas" value="4" />
            <Picker.Item label="A cada 6 horas" value="6" />
            <Picker.Item label="A cada 8 horas" value="8" />
            <Picker.Item label="A cada 12 horas" value="12" />
            <Picker.Item label="A cada 24 horas" value="24" />
          </Picker>
        </View>
        
        <TouchableOpacity style={[styles.botaoHorario, isDarkMode && styles.inputDark]} onPress={() => setShowPicker(true)}>
          <Text style={[styles.textoBotaoHorario, isDarkMode && styles.textoDark]}>Horário: {horarioForm}</Text>
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
  cardPerfilDark: { backgroundColor: '#1A3320', borderColor: '#28A745' },
  
  inputPerfil: { backgroundColor: '#FFFFFF', color: '#000000', padding: 12, borderWidth: 1, borderColor: '#91FFA2', fontSize: 18, fontWeight: 'bold', textAlign: 'center', borderRadius: 5 },
  
  cardCadastro: { backgroundColor: '#FFFFFF', padding: 15, borderWidth: 1, borderColor: '#DDDDDD', marginBottom: 20 },
  cardCadastroDark: { backgroundColor: '#1E1E1E', borderColor: '#333333' },
  
  tituloSecao: { color: '#333333', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  textoDark: { color: '#FFFFFF' },
  
  input: { backgroundColor: '#FFFFFF', color: '#000000', padding: 15, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 12, fontSize: 18, borderRadius: 5 },
  inputDark: { backgroundColor: '#2C2C2C', color: '#FFFFFF', borderColor: '#444444' },
  
  pickerContainer: { borderWidth: 1, borderColor: '#CCCCCC', backgroundColor: '#FFFFFF', marginBottom: 12, justifyContent: 'center', borderRadius: 5 },
  
  botaoHorario: { backgroundColor: '#FFFFFF', padding: 15, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 12, alignItems: 'center', borderRadius: 5 },
  textoBotaoHorario: { color: '#333333', fontSize: 18, fontWeight: 'bold' },
  
  botaoSalvar: { backgroundColor: '#91FFA2', padding: 15, alignItems: 'center', marginTop: 5, borderRadius: 5 }, 
  textoBotaoSalvar: { color: '#000000', fontWeight: 'bold', fontSize: 18 }
});