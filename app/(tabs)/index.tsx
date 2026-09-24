import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Modal, Vibration, Platform, TextInput, FlatList, KeyboardAvoidingView, DeviceEventEmitter, Image } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, { TriggerType, AndroidImportance, EventType, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { iniciarBanco, adicionarMedicamento, listarMedicamentos, deletarMedicamento, salvarNomePaciente, obterNomePaciente, Medicamento } from '../../database';

//escuta o clique na notificacao quando o app ta em segundo plano e avisa a tela
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    DeviceEventEmitter.emit('alarmeBackground', detail.notification);
  }
});

export default function HomeScreen() {
  //estados principais
  const [chamadaVisivel, setChamadaVisivel] = useState(false);
  const chamadaAtivaRef = useRef(false);
  const [resumoRemedios, setResumoRemedios] = useState('');
  const [chamadaAtendida, setChamadaAtendida] = useState(false);
  const [pacienteAtual, setPacienteAtual] = useState(''); 
  const somChamada = useRef<Audio.Sound | null>(null);

  //estados do app
  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'lista'>('cadastro'); //controle das abas
  const [nomePacienteGlobal, setNomePacienteGlobal] = useState('');
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  
  //estados do formulario
  const [nomeForm, setNomeForm] = useState('');
  const [dosagemForm, setDosagemForm] = useState('');
  const [intervaloForm, setIntervaloForm] = useState(''); 
  const [horarioForm, setHorarioForm] = useState('Clique para selecionar');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  //estados da lixeira
  const [modalExclusaoVisivel, setModalExclusaoVisivel] = useState(false);
  const [idParaExcluir, setIdParaExcluir] = useState<number | null>(null);

  //inicialização
  useEffect(() => {
    iniciarBanco();
    setMedicamentos(listarMedicamentos());
    setNomePacienteGlobal(obterNomePaciente()); 
    configurarNotifee();

    const tratarNotificacao = (remedios?: string, paciente?: string) => {
      if (remedios) dispararTelaChamada(remedios, paciente || 'Paciente');
    };

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

  //permissoes
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

  const onChangeTime = (_: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setHorarioForm(`${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`);
    }
  };

  //alarme
  const agendarAlarmeReal = async (idNotificacao: string, nomeRemedio: string, dosagem: string, horaBase: Date, offsetHoras: number) => {
    try {
      const dataAlarme = new Date();
      dataAlarme.setHours(horaBase.getHours() + offsetHoras, horaBase.getMinutes(), 0, 0);
      
      const agora = new Date();
      agora.setSeconds(0, 0); 

      if (dataAlarme.getTime() < agora.getTime()) {
        dataAlarme.setDate(dataAlarme.getDate() + 1);
      } else if (dataAlarme.getTime() === agora.getTime()) {
        dataAlarme.setSeconds(new Date().getSeconds() + 5);
      }

      await notifee.createTriggerNotification({
        id: idNotificacao,
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
        type: TriggerType.TIMESTAMP, timestamp: dataAlarme.getTime(), alarmManager: { allowWhileIdle: true }
      });
      return true; 
    } catch (erro) {
      return false; 
    }
  };

  //banco e crud com reincidencia
  const salvarRemedio = async () => {
    if (!(await verificarPermissoesCriticas())) return;
    if (!nomeForm || !dosagemForm || horarioForm === 'Clique para selecionar') return Alert.alert('erro', 'preencha todos os campos do remedio');

    const horarioParaBanco = intervaloForm ? `${horarioForm} (de ${intervaloForm} em ${intervaloForm}h)` : horarioForm;
    const novoId = adicionarMedicamento(nomeForm, dosagemForm, horarioParaBanco);
    
    const qtdHoras = parseInt(intervaloForm) || 0;
    const repeticoes = qtdHoras > 0 ? 3 : 1; 
    
    let deuErro = false;
    for(let i = 0; i < repeticoes; i++) {
      const sucesso = await agendarAlarmeReal(`${novoId}_${i}`, nomeForm, dosagemForm, date, i * qtdHoras);
      if(!sucesso) deuErro = true;
    }
    
    if (!deuErro) {
      setNomeForm(''); setDosagemForm(''); setIntervaloForm(''); setHorarioForm('Clique para selecionar');
      setMedicamentos(listarMedicamentos());
      Alert.alert('sucesso', 'remedio programado');
      setAbaAtiva('lista');
    } else {
      deletarMedicamento(novoId); 
      Alert.alert('erro', 'o sistema bloqueou o alarme');
    }
  };

  //funcoes da lixeira
  const perguntarRemover = (id: number) => {
    setIdParaExcluir(id);
    setModalExclusaoVisivel(true);
  };

  const confirmarRemoverRemedio = async () => {
    if (idParaExcluir !== null) {
      deletarMedicamento(idParaExcluir);
      await notifee.cancelNotification(`${idParaExcluir}_0`);
      await notifee.cancelNotification(`${idParaExcluir}_1`);
      await notifee.cancelNotification(`${idParaExcluir}_2`);
      setMedicamentos(listarMedicamentos());
    }
    setModalExclusaoVisivel(false);
    setIdParaExcluir(null);
  };

  //chamada
  const dispararTelaChamada = async (textoAgrupado: string, pacienteOuvinte: string) => {
    if (chamadaAtivaRef.current) return; 
    chamadaAtivaRef.current = true;

    setChamadaAtendida(false); setChamadaVisivel(true); 
    setResumoRemedios(textoAgrupado || "seus remedios");
    setPacienteAtual(pacienteOuvinte); 
    
    Speech.stop();
    Vibration.vibrate([1000, 1000], true);

    try {
      const { sound } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' }, { isLooping: true });
      somChamada.current = sound;
      await sound.playAsync(); 
    } catch (erro) {
      console.log("sem internet");
    }
  };

  const atenderChamada = async () => {
    Vibration.cancel(); Speech.stop();

    if (somChamada.current) { 
      try { await somChamada.current.stopAsync(); await somChamada.current.unloadAsync(); } catch(e) {}
      somChamada.current = null;
    }
    
    setChamadaAtendida(true);
    Speech.speak(`alo ${pacienteAtual}! esta na hora de tomar: ${resumoRemedios}`, { language: 'pt-BR', rate: 0.9 });
  };

  const desligarChamada = async () => { 
    Speech.stop(); Vibration.cancel();
    
    if (somChamada.current) { 
      try { await somChamada.current.stopAsync(); await somChamada.current.unloadAsync(); } catch(e) {}
      somChamada.current = null; 
    }
    
    setChamadaVisivel(false); 
    chamadaAtivaRef.current = false; 
  };

  //interface
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      {/* cabecalho sempre visivel */}
      <View style={styles.header}>
        <Image source={require('../../assets/images/logo_medalo.png')} style={styles.logoCabecalho} />
        <Text style={styles.tituloApp}>medalo</Text>
        <Text style={styles.subtituloApp}>tela para o cuidador</Text>
      </View>

      {/* ABA DE CADASTRO */}
      {abaAtiva === 'cadastro' && (
        <View style={styles.areaAba}>
          <View style={styles.cardPerfil}>
            <Text style={styles.tituloSecao}>quem vai tomar os remedios?</Text>
            <TextInput style={styles.inputPerfil} placeholder="ex: dona maria" placeholderTextColor="#888" value={nomePacienteGlobal} onChangeText={atualizarPerfilPaciente} />
          </View>

          <View style={styles.cardCadastro}>
            <Text style={styles.tituloSecao}>cadastrar remedio</Text>
            <TextInput style={styles.input} placeholder="nome do remedio" placeholderTextColor="#888" value={nomeForm} onChangeText={setNomeForm} />
            <TextInput style={styles.input} placeholder="dosagem (ex: 50mg)" placeholderTextColor="#888" value={dosagemForm} onChangeText={setDosagemForm} />
            
            <TextInput style={styles.input} placeholder="repetir a cada (ex: 8 horas) opcional" placeholderTextColor="#888" value={intervaloForm} onChangeText={setIntervaloForm} keyboardType="numeric" />
            
            <TouchableOpacity style={styles.botaoHorario} onPress={() => setShowPicker(true)}>
              <Text style={styles.textoBotaoHorario}>horario: {horarioForm}</Text>
            </TouchableOpacity>
            {showPicker && <DateTimePicker value={date} mode="time" is24Hour={true} display="default" onChange={onChangeTime} />}

            <TouchableOpacity style={styles.botaoSalvar} onPress={salvarRemedio}><Text style={styles.textoBotaoSalvar}>salvar na lista</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* ABA DE LISTA */}
      {abaAtiva === 'lista' && (
        <View style={styles.areaAba}>
          <Text style={styles.tituloSecaoLista}>lista de agendamentos</Text>
          <FlatList data={medicamentos} keyExtractor={(item) => item.id.toString()} style={styles.lista}
            ListEmptyComponent={<Text style={styles.listaVazia}>nenhum registro encontrado</Text>}
            renderItem={({ item }) => (
              <View style={styles.itemLista}>
                <View style={styles.textosDaLista}>
                  <Text style={styles.itemNome}>{item.nome}</Text><Text style={styles.itemDetalhes}>{item.dosagem} as {item.horario}</Text>
                </View>
                <TouchableOpacity onPress={() => perguntarRemover(item.id)}><Text style={styles.iconeLixeira}>🗑️</Text></TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* menu inferior de navegacao (tabs) COM IMAGENS */}
      <View style={styles.barraNavegacao}>
        <TouchableOpacity style={[styles.botaoAba, abaAtiva === 'cadastro' && styles.abaSelecionada]} onPress={() => setAbaAtiva('cadastro')}>
          <Image 
            source={require('../../assets/images/tabs_registro_mediacamento.png')} 
            style={[styles.iconeTab, abaAtiva === 'cadastro' && styles.iconeTabAtiva]} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.botaoAba, abaAtiva === 'lista' && styles.abaSelecionada]} onPress={() => setAbaAtiva('lista')}>
          <Image 
            source={require('../../assets/images/tabs_horarios_registrados.png')} 
            style={[styles.iconeTab, abaAtiva === 'lista' && styles.iconeTabAtiva]} 
          />
        </TouchableOpacity>
      </View>

      {/* modal de exclusao estilo ios */}
      <Modal visible={modalExclusaoVisivel} transparent={true} animationType="fade">
        <View style={styles.fundoModalEscuro}>
          <View style={styles.caixinhaModal}>
            <Text style={styles.tituloModal}>apagar remedio?</Text>
            <Text style={styles.textoModal}>essa acao ira remover o alarme.</Text>
            <View style={styles.botoesModal}>
              <TouchableOpacity style={styles.botaoModalCancelar} onPress={() => setModalExclusaoVisivel(false)}><Text style={styles.textoBotaoModal}>cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.botaoModalExcluir} onPress={confirmarRemoverRemedio}><Text style={styles.textoBotaoExcluirModal}>sim, excluir</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* tela da chamada */}
      <Modal visible={chamadaVisivel} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.telaChamadaContainer}>
          <View style={styles.topoChamada}>
            <Text style={styles.textoStatusChamada}>{chamadaAtendida ? "00:01" : "chamada recebida"}</Text>
            <Text style={styles.nomeContato}>assistente medalo</Text><Text style={styles.subContato}>lembrete para {pacienteAtual}</Text>
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatarCiculo}>
              <Image source={require('../../assets/images/logo_medalo.png')} style={styles.logoChamada} />
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
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: 40 },
  header: { alignItems: 'center', marginBottom: 15 },
  logoCabecalho: { width: 70, height: 70, resizeMode: 'contain', marginBottom: 5 },
  tituloApp: { fontSize: 24, fontWeight: 'bold', color: '#333333' }, subtituloApp: { fontSize: 14, color: '#666666' },
  
  areaAba: { flex: 1, paddingHorizontal: 20 },
  
  cardPerfil: { backgroundColor: '#E5FFE9', padding: 15, borderWidth: 1, borderColor: '#91FFA2', marginBottom: 15, borderRadius: 5 },
  inputPerfil: { backgroundColor: '#FFFFFF', color: '#000000', padding: 10, borderWidth: 1, borderColor: '#91FFA2', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  
  cardCadastro: { backgroundColor: '#FFFFFF', padding: 15, borderWidth: 1, borderColor: '#DDDDDD', marginBottom: 20 },
  tituloSecao: { color: '#333333', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { backgroundColor: '#FFFFFF', color: '#000000', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, fontSize: 16 },
  botaoHorario: { backgroundColor: '#FFFFFF', padding: 12, borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 10, alignItems: 'center' },
  textoBotaoHorario: { color: '#333333', fontSize: 16, fontWeight: 'bold' },
  
  botaoSalvar: { backgroundColor: '#91FFA2', padding: 15, alignItems: 'center', marginTop: 5 }, 
  textoBotaoSalvar: { color: '#000000', fontWeight: 'bold', fontSize: 16 }, 
  
  tituloSecaoLista: { color: '#333333', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }, lista: { flex: 1, marginBottom: 10 },
  itemLista: { backgroundColor: '#FFFFFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderRadius: 8 },
  textosDaLista: { flex: 1 }, itemNome: { color: '#000000', fontSize: 18, fontWeight: 'bold' }, itemDetalhes: { color: '#555555', fontSize: 14, marginTop: 4 },
  iconeLixeira: { fontSize: 24 },
  listaVazia: { color: '#888888', textAlign: 'center', marginTop: 20, fontSize: 16 },

  //navegacao em abas (bottom tabs)
  barraNavegacao: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DDDDDD', paddingBottom: 20, paddingTop: 10 },
  botaoAba: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  abaSelecionada: { borderTopWidth: 3, borderTopColor: '#28A745', marginTop: -10, paddingTop: 13 },
  iconeTab: { width: 30, height: 30, resizeMode: 'contain', opacity: 0.5 }, 
  iconeTabAtiva: { opacity: 1, tintColor: '#28A745' }, //tinta verde quando a aba estiver selecionada

  //modal excluir
  fundoModalEscuro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  caixinhaModal: { backgroundColor: '#FFF', padding: 20, borderRadius: 10, width: '80%', alignItems: 'center' },
  tituloModal: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 }, textoModal: { color: '#666', marginBottom: 20 },
  botoesModal: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  botaoModalCancelar: { flex: 1, padding: 12, backgroundColor: '#EEE', borderRadius: 5, marginRight: 10, alignItems: 'center' },
  botaoModalExcluir: { flex: 1, padding: 12, backgroundColor: '#DC3545', borderRadius: 5, alignItems: 'center' },
  textoBotaoModal: { color: '#333', fontWeight: 'bold' }, textoBotaoExcluirModal: { color: '#FFF', fontWeight: 'bold' },

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