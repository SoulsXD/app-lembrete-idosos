import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Modal, Vibration, Platform, TextInput, FlatList, KeyboardAvoidingView, DeviceEventEmitter, Image } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, { TriggerType, AndroidImportance, EventType, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { iniciarBanco, adicionarMedicamento, listarMedicamentos, deletarMedicamento, salvarNomePaciente, obterNomePaciente, Medicamento } from '../../database';

notifee.onBackgroundEvent(async () => {}); //função para que as notificações funcionem mesmo com o app fechado

export default function HomeScreen() {
  //estados
  const [chamadaVisivel, setChamadaVisivel] = useState(false);
  const chamadaAtivaRef = useRef(false);
  const [resumoRemedios, setResumoRemedios] = useState('');
  const [chamadaAtendida, setChamadaAtendida] = useState(false);
  const [pacienteAtual, setPacienteAtual] = useState(''); 
  const somChamada = useRef<Audio.Sound | null>(null);

  const [nomePacienteGlobal, setNomePacienteGlobal] = useState('');
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [nomeForm, setNomeForm] = useState('');
  const [dosagemForm, setDosagemForm] = useState('');
  const [horarioForm, setHorarioForm] = useState('Clique para selecionar');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  //inicialização do banco e do notifee
  useEffect(() => {
    iniciarBanco();
    setMedicamentos(listarMedicamentos());
    setNomePacienteGlobal(obterNomePaciente()); 
    configurarNotifee();

    const tratarNotificacao = (remedios?: string, paciente?: string) => {
      if (remedios) dispararTelaChamada(remedios, paciente || 'Paciente');
    };

    //detecta que a notificação foi clicada e abre a tela de chamada (ou se ja esta no app)
    notifee.getInitialNotification().then(n => {
      if (n) tratarNotificacao(n.notification.data?.remedios as string, n.notification.data?.paciente as string);
    });
    
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        tratarNotificacao(detail.notification?.data?.remedios as string, detail.notification?.data?.paciente as string);
      }
    });

    const subBackground = DeviceEventEmitter.addListener('alarmeBackground', (notification) => {
      tratarNotificacao(notification?.data?.remedios, notification?.data?.paciente);
    });

    return () => {
      unsubscribe();
      subBackground.remove();
    };
  }, []);

  //permissoes necessarias (noticação, alarme e bateria)
  async function configurarNotifee() {
    await notifee.requestPermission();
    await notifee.createChannel({
      id: 'lembretes_v2', name: 'lembretes', importance: AndroidImportance.HIGH, vibration: true, sound: 'default' 
    });
  }

  async function verificarPermissoesCriticas() {
    if (Platform.OS === 'android') {
      if (await notifee.isBatteryOptimizationEnabled()) {
        Alert.alert('Desativar otimização de bateria', 'desative a otimizacao de bateria para que o aplicativo funcione corretamente.', [
          { text: 'abrir configuracoes', onPress: () => notifee.openBatteryOptimizationSettings() }
        ]);
        return false;
      }
    }
    return true;
  }

  const atualizarPerfilPaciente = (texto: string) => {
    setNomePacienteGlobal(texto);
    salvarNomePaciente(texto);
  };

  //formata o horário selecionado pelo DateTimePicker para que fique em hora:minuto
  const onChangeTime = (_: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setHorarioForm(`${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`);
    }
  };

  //alarme e notificação
  const agendarAlarmeReal = async (idDoBanco: string, nomeRemedio: string, dosagem: string, horario: string) => {
    try {
      const [hora, minuto] = horario.split(':').map(Number);
      const dataAlarme = new Date();
      dataAlarme.setHours(hora, minuto, 0, 0);
      if (dataAlarme.getTime() <= Date.now()) dataAlarme.setDate(dataAlarme.getDate() + 1);

      await notifee.createTriggerNotification({
        id: idDoBanco,
        title: 'hora do remedio', 
        body: `toque para atender: ${nomeRemedio}`, 
        data: { remedios: `${nomeRemedio} ${dosagem}`, paciente: nomePacienteGlobal }, 
        android: { 
          channelId: 'lembretes_v2',
          category: AndroidCategory.ALARM, 
          visibility: AndroidVisibility.PUBLIC, 
          pressAction: { id: 'default', launchActivity: 'default' }, 
          fullScreenAction: { id: 'default', launchActivity: 'default' } 
        },
      }, { 
        type: TriggerType.TIMESTAMP, 
        timestamp: dataAlarme.getTime(), 
        alarmManager: { allowWhileIdle: true }
      });
      return true; //retorna verdadeiro se o android aceitou criar o alarme (estava dando erro)
    } catch (erro) {
      console.error(erro);
      Alert.alert('Erro no Sistema', 'O Android bloqueou o agendamento exato. Vá nas configurações do app e libere a permissão de "Alarmes e Lembretes".');
      return false; //retorna falso se o android bloqueou (estava dando erro)
    }
  };

  //banco e crud
  const salvarRemedio = async () => {
    if (!(await verificarPermissoesCriticas())) return;
    if (!nomeForm || !dosagemForm || horarioForm === 'Clique para selecionar') return Alert.alert('erro', 'preencha todos os campos do remedio');

    const novoId = adicionarMedicamento(nomeForm, dosagemForm, horarioForm);
    
    //tenta agendar no sistema, se der erro ele avisa e nao salva a mentira
    const agendouComSucesso = await agendarAlarmeReal(novoId.toString(), nomeForm, dosagemForm, horarioForm);
    
    if (agendouComSucesso) {
      setNomeForm(''); setDosagemForm(''); setHorarioForm('Clique para selecionar');
      setMedicamentos(listarMedicamentos());
      Alert.alert('sucesso', 'remedio programado');
    } else {
      deletarMedicamento(novoId); //apaga do banco se o android recusar o alarme para nao ter vicio
    }
  };

  const removerRemedio = async (id: number) => {
    deletarMedicamento(id);
    await notifee.cancelNotification(id.toString());
    setMedicamentos(listarMedicamentos());
  };

  //TTS, botoes, vibração e som da chamada
  const dispararTelaChamada = async (textoAgrupado: string, pacienteOuvinte: string) => {
    if (chamadaAtivaRef.current) return; 
    chamadaAtivaRef.current = true;

    setChamadaAtendida(false); setChamadaVisivel(true); 
    setResumoRemedios(textoAgrupado || "seus remedios");
    setPacienteAtual(pacienteOuvinte); 
    
    if (somChamada.current) {
      await somChamada.current.stopAsync();
      await somChamada.current.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' }, { isLooping: true });
    somChamada.current = sound;
    await sound.playAsync(); Vibration.vibrate([1000, 1000], true);
  };

  const atenderChamada = async () => {
    Vibration.cancel();
    if (somChamada.current) { await somChamada.current.stopAsync(); await somChamada.current.unloadAsync(); }
    setChamadaAtendida(true);
    
    Speech.speak(`alo ${pacienteAtual}! esta na hora de tomar: ${resumoRemedios}`, { language: 'pt-BR', rate: 0.9 });
  };

  const desligarChamada = () => { 
    Speech.stop(); 
    Vibration.cancel();
    if (somChamada.current) { somChamada.current.stopAsync(); }
    setChamadaVisivel(false); 
    chamadaAtivaRef.current = false; 
  };

  //interface do usuário
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <Image source={require('../../assets/images/logo_medalo.jpeg')} style={styles.logoCabecalho} />
        <Text style={styles.tituloApp}>medalo</Text>
        <Text style={styles.subtituloApp}>tela para o cuidador</Text>
      </View>

      <View style={styles.cardPerfil}>
        <Text style={styles.tituloSecao}>quem vai tomar os remedios?</Text>
        <TextInput 
          style={styles.inputPerfil} 
          placeholder="ex: dona maria" 
          placeholderTextColor="#888" 
          value={nomePacienteGlobal} 
          onChangeText={atualizarPerfilPaciente} 
        />
      </View>

      <View style={styles.cardCadastro}>
        <Text style={styles.tituloSecao}>cadastrar remedio</Text>
        <TextInput style={styles.input} placeholder="nome do remedio" placeholderTextColor="#888" value={nomeForm} onChangeText={setNomeForm} />
        <TextInput style={styles.input} placeholder="dosagem do remedio (ex: 50mg)" placeholderTextColor="#888" value={dosagemForm} onChangeText={setDosagemForm} />
        
        <TouchableOpacity style={styles.botaoHorario} onPress={() => setShowPicker(true)}>
          <Text style={styles.textoBotaoHorario}>horario: {horarioForm}</Text>
        </TouchableOpacity>
        {showPicker && <DateTimePicker value={date} mode="time" is24Hour={true} display="default" onChange={onChangeTime} />}

        <TouchableOpacity style={styles.botaoSalvar} onPress={salvarRemedio}><Text style={styles.textoBotaoSalvar}>salvar na lista</Text></TouchableOpacity>
      </View>

      <Text style={styles.tituloSecaoLista}>lista de agendamentos</Text>
      <FlatList data={medicamentos} keyExtractor={(item) => item.id.toString()} style={styles.lista}
        ListEmptyComponent={<Text style={styles.listaVazia}>nenhum registro encontrado</Text>}
        renderItem={({ item }) => (
          <View style={styles.itemLista}>
            <View>
              <Text style={styles.itemNome}>{item.nome}</Text><Text style={styles.itemDetalhes}>{item.dosagem} as {item.horario}</Text>
            </View>
            <TouchableOpacity style={styles.botaoDeletar} onPress={() => removerRemedio(item.id)}><Text style={styles.textoBotaoDeletar}>excluir</Text></TouchableOpacity>
          </View>
        )}
      />

      {/*interface da tela de chamada*/}
      <Modal visible={chamadaVisivel} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.telaChamadaContainer}>
          <View style={styles.topoChamada}>
            <Text style={styles.textoStatusChamada}>{chamadaAtendida ? "00:01" : "chamada recebida"}</Text>
            <Text style={styles.nomeContato}>assistente medalo</Text><Text style={styles.subContato}>lembrete para {pacienteAtual}</Text>
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatarCiculo}>
              <Image source={require('../../assets/images/logo_medalo.jpeg')} style={styles.logoChamada} />
            </View>
          </View>

          {chamadaAtendida && (
            <View style={styles.infoRemedioArea}>
               <Text style={styles.textoInfoRemedio}>tomar agora:</Text><Text style={styles.textoRemedioDestaque} numberOfLines={2}>{resumoRemedios}</Text>
            </View>
          )}

          <View style={styles.rodapeChamada}>
            {!chamadaAtendida ? (
              <TouchableOpacity style={styles.botaoAtenderVerde} onPress={atenderChamada}><Text style={styles.iconeBotaoGeral}>📞</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.botaoDesligarVermelho} onPress={desligarChamada}><Text style={styles.iconeBotaoGeral}>✖</Text></TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

//styles
const styles = StyleSheet.create({
  //tela principal
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 40 },
  header: { alignItems: 'center', marginBottom: 15 },
  logoCabecalho: { width: 70, height: 70, resizeMode: 'contain', marginBottom: 5 },
  tituloApp: { fontSize: 24, fontWeight: 'bold', color: '#333333' }, subtituloApp: { fontSize: 14, color: '#666666' },
  
  //cartao de perfil 
  cardPerfil: { backgroundColor: '#E5FFE9', padding: 15, borderWidth: 1, borderColor: '#91FFA2', marginBottom: 15, borderRadius: 5 },
  inputPerfil: { backgroundColor: '#FFFFFF', color: '#000000', padding: 10, borderWidth: 1, borderColor: '#91FFA2', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  
  cardCadastro: { backgroundColor: '#FFFFFF', padding: 15, borderWidth: 1, borderColor: '#DDDDDD', marginBottom: 20 },
  tituloSecao: { color: '#333333', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: '#FFFFFF', color: '#000000', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, fontSize: 16 },
  botaoHorario: { backgroundColor: '#FFFFFF', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, alignItems: 'center' },
  textoBotaoHorario: { color: '#333333', fontSize: 16, fontWeight: 'bold' },
  
  //botao salvar com o verde 91FFA2
  botaoSalvar: { backgroundColor: '#91FFA2', padding: 15, alignItems: 'center', marginTop: 5 }, 
  textoBotaoSalvar: { color: '#000000', fontWeight: 'bold', fontSize: 16 }, //letra preta para dar leitura no fundo verde claro
  
  //lista
  tituloSecaoLista: { color: '#333333', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }, lista: { flex: 1, marginBottom: 10 },
  itemLista: { backgroundColor: '#FFFFFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNome: { color: '#000000', fontSize: 18, fontWeight: 'bold' }, itemDetalhes: { color: '#555555', fontSize: 14, marginTop: 4 },
  botaoDeletar: { backgroundColor: '#DC3545', paddingVertical: 8, paddingHorizontal: 12 }, textoBotaoDeletar: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  listaVazia: { color: '#888888', textAlign: 'center', marginTop: 20, fontSize: 16 },
  
  //chamada
  telaChamadaContainer: { flex: 1, backgroundColor: '#1E1E24', paddingTop: 80, paddingBottom: 60, justifyContent: 'space-between' },
  topoChamada: { alignItems: 'center' }, textoStatusChamada: { color: '#A0A0A0', fontSize: 16, marginBottom: 10 },
  nomeContato: { color: '#FFFFFF', fontSize: 32, fontWeight: '300' }, subContato: { color: '#A0A0A0', fontSize: 18, marginTop: 5 },
  avatarContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  avatarCiculo: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, 
  logoChamada: { width: 110, height: 110, resizeMode: 'contain' },
  infoRemedioArea: { alignItems: 'center', paddingHorizontal: 30, marginBottom: 40 },
  textoInfoRemedio: { color: '#A0A0A0', fontSize: 18, marginBottom: 10 }, textoRemedioDestaque: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', textAlign: 'center' },
  rodapeChamada: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 50 },
  botaoAtenderVerde: { backgroundColor: '#28A745', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  botaoDesligarVermelho: { backgroundColor: '#DC3545', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  iconeBotaoGeral: { fontSize: 35, color: '#FFFFFF' }
});